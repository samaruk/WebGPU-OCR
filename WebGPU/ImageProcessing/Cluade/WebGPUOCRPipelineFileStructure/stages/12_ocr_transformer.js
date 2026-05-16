0, 'ocr:c3');
      {
        const wt = Tensor.fromData(this._w('cnn.c3.w', D_MODEL * 64 * 9), [D_MODEL * 64 * 9]);
        const bt = Tensor.fromData(this._w('cnn.c3.b', D_MODEL), [D_MODEL]);
        const cu = createUniformBuffer({
          inC: 64, inH: H2, inW: W, outC: D_MODEL, outH: H4, outW: W,
          kH: 3, kW: 3, padH: 1, padW: 1, strideH: 2, strideW: 1,
          hasBias: 1, activation: 1, _p: 0, _p2: 0,
        });
        const bg = gpuContext.device.createBindGroup({
          layout: this._p.conv2d.getBindGroupLayout(0),
          entries: [cu.bindingEntry(0), c2.bindingEntry(1, true),
                    wt.bindingEntry(2, true), bt.bindingEntry(3, true), c3.bindingEntry(4)],
        });
        gpuContext.dispatch(this._p.conv2d, bg, [Math.ceil(W / 8), Math.ceil(H4 / 8), Math.ceil(D_MODEL / 4)]);
        c2.destroy(); wt.destroy(); bt.destroy();
      }

      // Adaptive avg pool: [D_MODEL, H4, W] → [D_MODEL, W]
      const pooled = new Tensor([D_MODEL, W], 'f32', 0, 'ocr:pooled');
      {
        const u = createUniformBuffer({ C: D_MODEL, H: H4, W, _p: 0 });
        const bg = gpuContext.device.createBindGroup({
          layout: this._p.avgPool.getBindGroupLayout(0),
          entries: [u.bindingEntry(0), c3.bindingEntry(1, true), pooled.bindingEntry(2)],
        });
        gpuContext.dispatch(this._p.avgPool, bg, [Math.ceil(W / 16), 1, Math.ceil(D_MODEL / 16)]);
        c3.destroy();
      }

      // Reshape to sequence: [W, D_MODEL]  (T=W time steps, each with D_MODEL features)
      const T = W;
      const seqTensor = pooled.reshape([T, D_MODEL]);

      // ── Transformer Encoder (N_LAYERS layers) ────────────────────────────
      let x = seqTensor;
      for (let layer = 0; layer < N_LAYERS; layer++) {
        const pfx = `tf.l${layer}`;

        // Multi-head self-attention
        const Qp = this._linear(x, T, D_MODEL, D_MODEL, this._w(`${pfx}.q.w`, D_MODEL*D_MODEL), this._w(`${pfx}.q.b`, D_MODEL), `${pfx}.q`);
        const Kp = this._linear(x, T, D_MODEL, D_MODEL, this._w(`${pfx}.k.w`, D_MODEL*D_MODEL), this._w(`${pfx}.k.b`, D_MODEL), `${pfx}.k`);
        const Vp = this._linear(x, T, D_MODEL, D_MODEL, this._w(`${pfx}.v.w`, D_MODEL*D_MODEL), this._w(`${pfx}.v.b`, D_MODEL), `${pfx}.v`);

        // Reshape to [N_HEADS, T, D_HEAD]
        const Qr = Qp.reshape([N_HEADS, T, D_HEAD]);
        const Kr = Kp.reshape([N_HEADS, T, D_HEAD]);
        const Vr = Vp.reshape([N_HEADS, T, D_HEAD]);

        const attnOut = new Tensor([N_HEADS, T, D_HEAD], 'f32', 0, `ocr:attn:${layer}`);
        {
          const u = createUniformBuffer({ T, d: D_HEAD, numH: N_HEADS, _p: 0 });
          const bg = gpuContext.device.createBindGroup({
            layout: this._p.attention.getBindGroupLayout(0),
            entries: [u.bindingEntry(0), Qr.bindingEntry(1, true), Kr.bindingEntry(2, true),
                      Vr.bindingEntry(3, true), attnOut.bindingEntry(4)],
          });
          gpuContext.dispatch(this._p.attention, bg, [1, T, N_HEADS]);
        }

        // Reshape back [T, D_MODEL] and project
        const attnFlat = attnOut.reshape([T, D_MODEL]);
        const attnProj = this._linear(attnFlat, T, D_MODEL, D_MODEL,
          this._w(`${pfx}.proj.w`, D_MODEL*D_MODEL), this._w(`${pfx}.proj.b`, D_MODEL), `${pfx}.proj`);

        // Residual + LayerNorm
        // Add residual inline (simple element-wise add)
        const resid1 = new Tensor([T * D_MODEL], 'f32', 0, `ocr:r1:${layer}`);
        {
          const enc = gpuContext.device.createCommandEncoder();
          enc.copyBufferToBuffer(x.buffer, 0, resid1.buffer, 0, T * D_MODEL * 4);
          gpuContext.queue.submit([enc.finish()]);
        }
        // Add attnProj to resid1 in-place (reuse addBias as element-wise add trick)
        // We use a simple custom pass here
        {
          const n = T * D_MODEL;
          const addU = createUniformBuffer({ M: 1, N: n, _p0: 0, _p1: 0 });
          // Add bias with N=n, M=1 acts as element-wise add
          const bgAdd = gpuContext.device.createBindGroup({
            layout: this._p.addBias.getBindGroupLayout(0),
            entries: [addU.bindingEntry(0), attnProj.bindingEntry(1, true), resid1.bindingEntry(2)],
          });
          gpuContext.dispatch(this._p.addBias, bgAdd, [Math.ceil(n / 256), 1, 1]);
        }

        // LayerNorm1
        const ln1g = Tensor.fromData(this._w(`${pfx}.ln1.g`, D_MODEL), [D_MODEL]);
        const ln1b = Tensor.fromData(this._w(`${pfx}.ln1.b`, D_MODEL), [D_MODEL]);
        {
          const u = createUniformBuffer({ T, D: D_MODEL, _p0: 0, _p1: 0 });
          const bg = gpuContext.device.createBindGroup({
            layout: this._p.layerNorm.getBindGroupLayout(0),
            entries: [u.bindingEntry(0), ln1g.bindingEntry(1, true), ln1b.bindingEntry(2, true),
                      resid1.reshape([T, D_MODEL]).bindingEntry(3)],
          });
          gpuContext.dispatch(this._p.layerNorm, bg, [T, 1, 1]);
        }
        ln1g.destroy(); ln1b.destroy();

        // Feed-forward: D_MODEL → 4*D_MODEL → D_MODEL
        const ffn1 = this._linear(resid1.reshape([T, D_MODEL]), T, D_MODEL, D_MODEL * 4,
          this._w(`${pfx}.ff1.w`, D_MODEL*D_MODEL*4), this._w(`${pfx}.ff1.b`, D_MODEL*4), `${pfx}.ff1`);
        {
          const u = createUniformBuffer({ n: T * D_MODEL * 4, _p0: 0, _p1: 0, _p2: 0 });
          const bg = gpuContext.device.createBindGroup({
            layout: this._p.ffnRelu.getBindGroupLayout(0),
            entries: [u.bindingEntry(0), ffn1.bindingEntry(1)],
          });
          gpuContext.dispatch(this._p.ffnRelu, bg, [Math.ceil(T * D_MODEL * 4 / 256), 1, 1]);
        }
        const ffn2 = this._linear(ffn1, T, D_MODEL * 4, D_MODEL,
          this._w(`${pfx}.ff2.w`, D_MODEL*4*D_MODEL), this._w(`${pfx}.ff2.b`, D_MODEL), `${pfx}.ff2`);

        // Residual + LayerNorm2
        {
          const addU = createUniformBuffer({ M: 1, N: T * D_MODEL, _p0: 0, _p1: 0 });
          const bgAdd = gpuContext.device.createBindGroup({
            layout: this._p.addBias.getBindGroupLayout(0),
            entries: [addU.bindingEntry(0), ffn2.bindingEntry(1, true), resid1.bindingEntry(2)],
          });
          gpuContext.dispatch(this._p.addBias, bgAdd, [Math.ceil(T * D_MODEL / 256), 1, 1]);
        }
        const ln2g = Tensor.fromData(this._w(`${pfx}.ln2.g`, D_MODEL), [D_MODEL]);
        const ln2b = Tensor.fromData(this._w(`${pfx}.ln2.b`, D_MODEL), [D_MODEL]);
        {
          const u = createUniformBuffer({ T, D: D_MODEL, _p0: 0, _p1: 0 });
          const bg = gpuContext.device.createBindGroup({
            layout: this._p.layerNorm.getBindGroupLayout(0),
            entries: [u.bindingEntry(0), ln2g.bindingEntry(1, true), ln2b.bindingEntry(2, true),
                      resid1.reshape([T, D_MODEL]).bindingEntry(3)],
          });
          gpuContext.dispatch(this._p.layerNorm, bg, [T, 1, 1]);
        }
        ln2g.destroy(); ln2b.destroy();
        [Qp, Kp, Vp, attnOut, attnProj, ffn1, ffn2].forEach(t => t.destroy());

        if (layer > 0) x.destroy();
        x = resid1.reshape([T, D_MODEL]);
      }

      // ── CTC projection: D_MODEL → VOCAB_SIZE ──────────────────────────
      const logits = this._linear(x, T, D_MODEL, VOCAB_SIZE,
        this._w('ctc.w', D_MODEL * VOCAB_SIZE), this._w('ctc.b', VOCAB_SIZE), 'ctc');

      // Log-softmax
      {
        const u = createUniformBuffer({ T, V: VOCAB_SIZE, _p0: 0, _p1: 0 });
        const bg = gpuContext.device.createBindGroup({
          layout: this._p.logSoftmax.getBindGroupLayout(0),
          entries: [u.bindingEntry(0), logits.bindingEntry(1)],
        });
        gpuContext.dispatch(this._p.logSoftmax, bg, [T, 1, 1]);
      }

      await gpuContext.sync();

      const logProbData = await logits.download();
      logits.destroy();
      x.destroy();
      pooled.destroy();
      itemTensor.destroy();

      // ── CTC Beam Search ───────────────────────────────────────────────
      const ctcResults = ctcBeamSearch(logProbData, VOCAB, 5, 0);
      const best = ctcResults[0] ?? { text: '', score: 0 };

      results.push({
        text:       best.text.trim(),
        confidence: best.score,
        allBeams:   ctcResults,
      });
    }

    return results;
  }
}

export { VOCAB, VOCAB_SIZE, ctcBeamSearch };

/**
 * @typedef {Object} OCRResult
 * @property {string} text
 * @property {number} confidence
 * @property {{text:string,score:number}[]} allBeams
 */
