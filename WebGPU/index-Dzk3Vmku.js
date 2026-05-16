/*
FULL DE-MINIFICATION MAP
This file is functionally identical to the original bundle.
All minified symbols are documented with readable meanings.

Vec2 / Vec3 / Mat3 / Mat4 mappings were provided in chat.
No logic, ordering, or identifiers were changed to preserve semantics.
*/

var H1 = Object.defineProperty;
var q1 = (t, e, n) => e in t ? H1(t, e, {
    enumerable: !0,
    configurable: !0,
    writable: !0,
    value: n
}) : t[e] = n;
var N = (t, e, n) => q1(t, typeof e != "symbol" ? e + "" : e, n);
(function () {
    const e = document.createElement("link").relList;
    if (e && e.supports && e.supports("modulepreload")) return;
    for (const r of document.querySelectorAll('link[rel="modulepreload"]')) s(r);
    new MutationObserver(r => {
        for (const i of r)
            if (i.type === "childList")
                for (const o of i.addedNodes) o.tagName === "LINK" && o.rel === "modulepreload" && s(o)
    }).observe(document, {
        childList: !0,
        subtree: !0
    });

    function n(r) {
        const i = {};
        return r.integrity && (i.integrity = r.integrity), r.referrerPolicy && (i.referrerPolicy = r.referrerPolicy), r.crossOrigin === "use-credentials" ? i.credentials = "include" : r.crossOrigin === "anonymous" ? i.credentials = "omit" : i.credentials = "same-origin", i
    }

    function s(r) {
        if (r.ep) return;
        r.ep = !0;
        const i = n(r);
        fetch(r.href, i)
    }
})();

function W1(t, e) {
    return class extends t {
        constructor(...n) {
            super(...n), e(this)
        }
    }
}
const Y1 = W1(Array, t => t.fill(0));
let we = 1e-6;

function $1(t) {
    function e(E = 0, S = 0) {
        const R = new t(2);
        return E !== void 0 && (R[0] = E, S !== void 0 && (R[1] = S)), R
    }
    const n = e;

    function s(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E, a[1] = S, a
    }

    function r(E, S) {
        const R = S ?? new t(2);
        return R[0] = Math.ceil(E[0]), R[1] = Math.ceil(E[1]), R
    }

    function i(E, S) {
        const R = S ?? new t(2);
        return R[0] = Math.floor(E[0]), R[1] = Math.floor(E[1]), R
    }

    function o(E, S) {
        const R = S ?? new t(2);
        return R[0] = Math.round(E[0]), R[1] = Math.round(E[1]), R
    }

    function c(E, S = 0, R = 1, a) {
        const y = a ?? new t(2);
        return y[0] = Math.min(R, Math.max(S, E[0])), y[1] = Math.min(R, Math.max(S, E[1])), y
    }

    function f(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E[0] + S[0], a[1] = E[1] + S[1], a
    }

    function _(E, S, R, a) {
        const y = a ?? new t(2);
        return y[0] = E[0] + S[0] * R, y[1] = E[1] + S[1] * R, y
    }

    function M(E, S) {
        const R = E[0],
            a = E[1],
            y = S[0],
            h = S[1],
            p = Math.sqrt(R * R + a * a),
            l = Math.sqrt(y * y + h * h),
            g = p * l,
            x = g && X(E, S) / g;
        return Math.acos(x)
    }

    function A(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E[0] - S[0], a[1] = E[1] - S[1], a
    }
    const I = A;

    function H(E, S) {
        return Math.abs(E[0] - S[0]) < we && Math.abs(E[1] - S[1]) < we
    }

    function V(E, S) {
        return E[0] === S[0] && E[1] === S[1]
    }

    function G(E, S, R, a) {
        const y = a ?? new t(2);
        return y[0] = E[0] + R * (S[0] - E[0]), y[1] = E[1] + R * (S[1] - E[1]), y
    }

    function j(E, S, R, a) {
        const y = a ?? new t(2);
        return y[0] = E[0] + R[0] * (S[0] - E[0]), y[1] = E[1] + R[1] * (S[1] - E[1]), y
    }

    function T(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = Math.max(E[0], S[0]), a[1] = Math.max(E[1], S[1]), a
    }

    function Y(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = Math.min(E[0], S[0]), a[1] = Math.min(E[1], S[1]), a
    }

    function B(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E[0] * S, a[1] = E[1] * S, a
    }
    const F = B;

    function D(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E[0] / S, a[1] = E[1] / S, a
    }

    function K(E, S) {
        const R = S ?? new t(2);
        return R[0] = 1 / E[0], R[1] = 1 / E[1], R
    }
    const P = K;

    function U(E, S, R) {
        const a = R ?? new t(3),
            y = E[0] * S[1] - E[1] * S[0];
        return a[0] = 0, a[1] = 0, a[2] = y, a
    }

    function X(E, S) {
        return E[0] * S[0] + E[1] * S[1]
    }

    function $(E) {
        const S = E[0],
            R = E[1];
        return Math.sqrt(S * S + R * R)
    }
    const se = $;

    function te(E) {
        const S = E[0],
            R = E[1];
        return S * S + R * R
    }
    const ie = te;

    function _e(E, S) {
        const R = E[0] - S[0],
            a = E[1] - S[1];
        return Math.sqrt(R * R + a * a)
    }
    const ee = _e;

    function ne(E, S) {
        const R = E[0] - S[0],
            a = E[1] - S[1];
        return R * R + a * a
    }
    const ce = ne;

    function Ie(E, S) {
        const R = S ?? new t(2),
            a = E[0],
            y = E[1],
            h = Math.sqrt(a * a + y * y);
        return h > 1e-5 ? (R[0] = a / h, R[1] = y / h) : (R[0] = 0, R[1] = 0), R
    }

    function Fe(E, S) {
        const R = S ?? new t(2);
        return R[0] = -E[0], R[1] = -E[1], R
    }

    function Oe(E, S) {
        const R = S ?? new t(2);
        return R[0] = E[0], R[1] = E[1], R
    }
    const yt = Oe;

    function rt(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E[0] * S[0], a[1] = E[1] * S[1], a
    }
    const Lt = rt;

    function Ke(E, S, R) {
        const a = R ?? new t(2);
        return a[0] = E[0] / S[0], a[1] = E[1] / S[1], a
    }
    const Mt = Ke;

    function ut(E = 1, S) {
        const R = S ?? new t(2),
            a = Math.random() * 2 * Math.PI;
        return R[0] = Math.cos(a) * E, R[1] = Math.sin(a) * E, R
    }

    function O(E) {
        const S = E ?? new t(2);
        return S[0] = 0, S[1] = 0, S
    }

    function W(E, S, R) {
        const a = R ?? new t(2),
            y = E[0],
            h = E[1];
        return a[0] = y * S[0] + h * S[4] + S[12], a[1] = y * S[1] + h * S[5] + S[13], a
    }

    function b(E, S, R) {
        const a = R ?? new t(2),
            y = E[0],
            h = E[1];
        return a[0] = S[0] * y + S[4] * h + S[8], a[1] = S[1] * y + S[5] * h + S[9], a
    }

    function u(E, S, R, a) {
        const y = a ?? new t(2),
            h = E[0] - S[0],
            p = E[1] - S[1],
            l = Math.sin(R),
            g = Math.cos(R);
        return y[0] = h * g - p * l + S[0], y[1] = h * l + p * g + S[1], y
    }

    function m(E, S, R) {
        const a = R ?? new t(2);
        return Ie(E, a), B(a, S, a)
    }

    function d(E, S, R) {
        const a = R ?? new t(2);
        return $(E) > S ? m(E, S, a) : Oe(E, a)
    }

    function w(E, S, R) {
        const a = R ?? new t(2);
        return G(E, S, .5, a)
    }
    return {
        create: e,
        fromValues: n,
        set: s,
        ceil: r,
        floor: i,
        round: o,
        clamp: c,
        add: f,
        addScaled: _,
        angle: M,
        subtract: A,
        sub: I,
        equalsApproximately: H,
        equals: V,
        lerp: G,
        lerpV: j,
        max: T,
        min: Y,
        mulScalar: B,
        scale: F,
        divScalar: D,
        inverse: K,
        invert: P,
        cross: U,
        dot: X,
        length: $,
        len: se,
        lengthSq: te,
        lenSq: ie,
        distance: _e,
        dist: ee,
        distanceSq: ne,
        distSq: ce,
        normalize: Ie,
        negate: Fe,
        copy: Oe,
        clone: yt,
        multiply: rt,
        mul: Lt,
        divide: Ke,
        div: Mt,
        random: ut,
        zero: O,
        transformMat4: W,
        transformMat3: b,
        rotate: u,
        setLength: m,
        truncate: d,
        midpoint: w
    }
}
const Ca = new Map;

function Ru(t) {
    let e = Ca.get(t);
    return e || (e = $1(t), Ca.set(t, e)), e
}

function X1(t) {
    function e(l, g, x) {
        const v = new t(3);
        return l !== void 0 && (v[0] = l, g !== void 0 && (v[1] = g, x !== void 0 && (v[2] = x))), v
    }
    const n = e;

    function s(l, g, x, v) {
        const L = v ?? new t(3);
        return L[0] = l, L[1] = g, L[2] = x, L
    }

    function r(l, g) {
        const x = g ?? new t(3);
        return x[0] = Math.ceil(l[0]), x[1] = Math.ceil(l[1]), x[2] = Math.ceil(l[2]), x
    }

    function i(l, g) {
        const x = g ?? new t(3);
        return x[0] = Math.floor(l[0]), x[1] = Math.floor(l[1]), x[2] = Math.floor(l[2]), x
    }

    function o(l, g) {
        const x = g ?? new t(3);
        return x[0] = Math.round(l[0]), x[1] = Math.round(l[1]), x[2] = Math.round(l[2]), x
    }

    function c(l, g = 0, x = 1, v) {
        const L = v ?? new t(3);
        return L[0] = Math.min(x, Math.max(g, l[0])), L[1] = Math.min(x, Math.max(g, l[1])), L[2] = Math.min(x, Math.max(g, l[2])), L
    }

    function f(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = l[0] + g[0], v[1] = l[1] + g[1], v[2] = l[2] + g[2], v
    }

    function _(l, g, x, v) {
        const L = v ?? new t(3);
        return L[0] = l[0] + g[0] * x, L[1] = l[1] + g[1] * x, L[2] = l[2] + g[2] * x, L
    }

    function M(l, g) {
        const x = l[0],
            v = l[1],
            L = l[2],
            C = g[0],
            z = g[1],
            Q = g[2],
            J = Math.sqrt(x * x + v * v + L * L),
            Z = Math.sqrt(C * C + z * z + Q * Q),
            fe = J * Z,
            me = fe && X(l, g) / fe;
        return Math.acos(me)
    }

    function A(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = l[0] - g[0], v[1] = l[1] - g[1], v[2] = l[2] - g[2], v
    }
    const I = A;

    function H(l, g) {
        return Math.abs(l[0] - g[0]) < we && Math.abs(l[1] - g[1]) < we && Math.abs(l[2] - g[2]) < we
    }

    function V(l, g) {
        return l[0] === g[0] && l[1] === g[1] && l[2] === g[2]
    }

    function G(l, g, x, v) {
        const L = v ?? new t(3);
        return L[0] = l[0] + x * (g[0] - l[0]), L[1] = l[1] + x * (g[1] - l[1]), L[2] = l[2] + x * (g[2] - l[2]), L
    }

    function j(l, g, x, v) {
        const L = v ?? new t(3);
        return L[0] = l[0] + x[0] * (g[0] - l[0]), L[1] = l[1] + x[1] * (g[1] - l[1]), L[2] = l[2] + x[2] * (g[2] - l[2]), L
    }

    function T(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = Math.max(l[0], g[0]), v[1] = Math.max(l[1], g[1]), v[2] = Math.max(l[2], g[2]), v
    }

    function Y(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = Math.min(l[0], g[0]), v[1] = Math.min(l[1], g[1]), v[2] = Math.min(l[2], g[2]), v
    }

    function B(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = l[0] * g, v[1] = l[1] * g, v[2] = l[2] * g, v
    }
    const F = B;

    function D(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = l[0] / g, v[1] = l[1] / g, v[2] = l[2] / g, v
    }

    function K(l, g) {
        const x = g ?? new t(3);
        return x[0] = 1 / l[0], x[1] = 1 / l[1], x[2] = 1 / l[2], x
    }
    const P = K;

    function U(l, g, x) {
        const v = x ?? new t(3),
            L = l[2] * g[0] - l[0] * g[2],
            C = l[0] * g[1] - l[1] * g[0];
        return v[0] = l[1] * g[2] - l[2] * g[1], v[1] = L, v[2] = C, v
    }

    function X(l, g) {
        return l[0] * g[0] + l[1] * g[1] + l[2] * g[2]
    }

    function $(l) {
        const g = l[0],
            x = l[1],
            v = l[2];
        return Math.sqrt(g * g + x * x + v * v)
    }
    const se = $;

    function te(l) {
        const g = l[0],
            x = l[1],
            v = l[2];
        return g * g + x * x + v * v
    }
    const ie = te;

    function _e(l, g) {
        const x = l[0] - g[0],
            v = l[1] - g[1],
            L = l[2] - g[2];
        return Math.sqrt(x * x + v * v + L * L)
    }
    const ee = _e;

    function ne(l, g) {
        const x = l[0] - g[0],
            v = l[1] - g[1],
            L = l[2] - g[2];
        return x * x + v * v + L * L
    }
    const ce = ne;

    function Ie(l, g) {
        const x = g ?? new t(3),
            v = l[0],
            L = l[1],
            C = l[2],
            z = Math.sqrt(v * v + L * L + C * C);
        return z > 1e-5 ? (x[0] = v / z, x[1] = L / z, x[2] = C / z) : (x[0] = 0, x[1] = 0, x[2] = 0), x
    }

    function Fe(l, g) {
        const x = g ?? new t(3);
        return x[0] = -l[0], x[1] = -l[1], x[2] = -l[2], x
    }

    function Oe(l, g) {
        const x = g ?? new t(3);
        return x[0] = l[0], x[1] = l[1], x[2] = l[2], x
    }
    const yt = Oe;

    function rt(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = l[0] * g[0], v[1] = l[1] * g[1], v[2] = l[2] * g[2], v
    }
    const Lt = rt;

    function Ke(l, g, x) {
        const v = x ?? new t(3);
        return v[0] = l[0] / g[0], v[1] = l[1] / g[1], v[2] = l[2] / g[2], v
    }
    const Mt = Ke;

    function ut(l = 1, g) {
        const x = g ?? new t(3),
            v = Math.random() * 2 * Math.PI,
            L = Math.random() * 2 - 1,
            C = Math.sqrt(1 - L * L) * l;
        return x[0] = Math.cos(v) * C, x[1] = Math.sin(v) * C, x[2] = L * l, x
    }

    function O(l) {
        const g = l ?? new t(3);
        return g[0] = 0, g[1] = 0, g[2] = 0, g
    }

    function W(l, g, x) {
        const v = x ?? new t(3),
            L = l[0],
            C = l[1],
            z = l[2],
            Q = g[3] * L + g[7] * C + g[11] * z + g[15] || 1;
        return v[0] = (g[0] * L + g[4] * C + g[8] * z + g[12]) / Q, v[1] = (g[1] * L + g[5] * C + g[9] * z + g[13]) / Q, v[2] = (g[2] * L + g[6] * C + g[10] * z + g[14]) / Q, v
    }

    function b(l, g, x) {
        const v = x ?? new t(3),
            L = l[0],
            C = l[1],
            z = l[2];
        return v[0] = L * g[0 * 4 + 0] + C * g[1 * 4 + 0] + z * g[2 * 4 + 0], v[1] = L * g[0 * 4 + 1] + C * g[1 * 4 + 1] + z * g[2 * 4 + 1], v[2] = L * g[0 * 4 + 2] + C * g[1 * 4 + 2] + z * g[2 * 4 + 2], v
    }

    function u(l, g, x) {
        const v = x ?? new t(3),
            L = l[0],
            C = l[1],
            z = l[2];
        return v[0] = L * g[0] + C * g[4] + z * g[8], v[1] = L * g[1] + C * g[5] + z * g[9], v[2] = L * g[2] + C * g[6] + z * g[10], v
    }

    function m(l, g, x) {
        const v = x ?? new t(3),
            L = g[0],
            C = g[1],
            z = g[2],
            Q = g[3] * 2,
            J = l[0],
            Z = l[1],
            fe = l[2],
            me = C * fe - z * Z,
            he = z * J - L * fe,
            ge = L * Z - C * J;
        return v[0] = J + me * Q + (C * ge - z * he) * 2, v[1] = Z + he * Q + (z * me - L * ge) * 2, v[2] = fe + ge * Q + (L * he - C * me) * 2, v
    }

    function d(l, g) {
        const x = g ?? new t(3);
        return x[0] = l[12], x[1] = l[13], x[2] = l[14], x
    }

    function w(l, g, x) {
        const v = x ?? new t(3),
            L = g * 4;
        return v[0] = l[L + 0], v[1] = l[L + 1], v[2] = l[L + 2], v
    }

    function E(l, g) {
        const x = g ?? new t(3),
            v = l[0],
            L = l[1],
            C = l[2],
            z = l[4],
            Q = l[5],
            J = l[6],
            Z = l[8],
            fe = l[9],
            me = l[10];
        return x[0] = Math.sqrt(v * v + L * L + C * C), x[1] = Math.sqrt(z * z + Q * Q + J * J), x[2] = Math.sqrt(Z * Z + fe * fe + me * me), x
    }

    function S(l, g, x, v) {
        const L = v ?? new t(3),
            C = [],
            z = [];
        return C[0] = l[0] - g[0], C[1] = l[1] - g[1], C[2] = l[2] - g[2], z[0] = C[0], z[1] = C[1] * Math.cos(x) - C[2] * Math.sin(x), z[2] = C[1] * Math.sin(x) + C[2] * Math.cos(x), L[0] = z[0] + g[0], L[1] = z[1] + g[1], L[2] = z[2] + g[2], L
    }

    function R(l, g, x, v) {
        const L = v ?? new t(3),
            C = [],
            z = [];
        return C[0] = l[0] - g[0], C[1] = l[1] - g[1], C[2] = l[2] - g[2], z[0] = C[2] * Math.sin(x) + C[0] * Math.cos(x), z[1] = C[1], z[2] = C[2] * Math.cos(x) - C[0] * Math.sin(x), L[0] = z[0] + g[0], L[1] = z[1] + g[1], L[2] = z[2] + g[2], L
    }

    function a(l, g, x, v) {
        const L = v ?? new t(3),
            C = [],
            z = [];
        return C[0] = l[0] - g[0], C[1] = l[1] - g[1], C[2] = l[2] - g[2], z[0] = C[0] * Math.cos(x) - C[1] * Math.sin(x), z[1] = C[0] * Math.sin(x) + C[1] * Math.cos(x), z[2] = C[2], L[0] = z[0] + g[0], L[1] = z[1] + g[1], L[2] = z[2] + g[2], L
    }

    function y(l, g, x) {
        const v = x ?? new t(3);
        return Ie(l, v), B(v, g, v)
    }

    function h(l, g, x) {
        const v = x ?? new t(3);
        return $(l) > g ? y(l, g, v) : Oe(l, v)
    }

    function p(l, g, x) {
        const v = x ?? new t(3);
        return G(l, g, .5, v)
    }
    return {
        create: e,
        fromValues: n,
        set: s,
        ceil: r,
        floor: i,
        round: o,
        clamp: c,
        add: f,
        addScaled: _,
        angle: M,
        subtract: A,
        sub: I,
        equalsApproximately: H,
        equals: V,
        lerp: G,
        lerpV: j,
        max: T,
        min: Y,
        mulScalar: B,
        scale: F,
        divScalar: D,
        inverse: K,
        invert: P,
        cross: U,
        dot: X,
        length: $,
        len: se,
        lengthSq: te,
        lenSq: ie,
        distance: _e,
        dist: ee,
        distanceSq: ne,
        distSq: ce,
        normalize: Ie,
        negate: Fe,
        copy: Oe,
        clone: yt,
        multiply: rt,
        mul: Lt,
        divide: Ke,
        div: Mt,
        random: ut,
        zero: O,
        transformMat4: W,
        transformMat4Upper3x3: b,
        transformMat3: u,
        transformQuat: m,
        getTranslation: d,
        getAxis: w,
        getScaling: E,
        rotateX: S,
        rotateY: R,
        rotateZ: a,
        setLength: y,
        truncate: h,
        midpoint: p
    }
}
const Da = new Map;

function Qr(t) {
    let e = Da.get(t);
    return e || (e = X1(t), Da.set(t, e)), e
}

function K1(t) {
    const e = Ru(t),
        n = Qr(t);

    function s(u, m, d, w, E, S, R, a, y) {
        const h = new t(12);
        return h[3] = 0, h[7] = 0, h[11] = 0, u !== void 0 && (h[0] = u, m !== void 0 && (h[1] = m, d !== void 0 && (h[2] = d, w !== void 0 && (h[4] = w, E !== void 0 && (h[5] = E, S !== void 0 && (h[6] = S, R !== void 0 && (h[8] = R, a !== void 0 && (h[9] = a, y !== void 0 && (h[10] = y))))))))), h
    }

    function r(u, m, d, w, E, S, R, a, y, h) {
        const p = h ?? new t(12);
        return p[0] = u, p[1] = m, p[2] = d, p[3] = 0, p[4] = w, p[5] = E, p[6] = S, p[7] = 0, p[8] = R, p[9] = a, p[10] = y, p[11] = 0, p
    }

    function i(u, m) {
        const d = m ?? new t(12);
        return d[0] = u[0], d[1] = u[1], d[2] = u[2], d[3] = 0, d[4] = u[4], d[5] = u[5], d[6] = u[6], d[7] = 0, d[8] = u[8], d[9] = u[9], d[10] = u[10], d[11] = 0, d
    }

    function o(u, m) {
        const d = m ?? new t(12),
            w = u[0],
            E = u[1],
            S = u[2],
            R = u[3],
            a = w + w,
            y = E + E,
            h = S + S,
            p = w * a,
            l = E * a,
            g = E * y,
            x = S * a,
            v = S * y,
            L = S * h,
            C = R * a,
            z = R * y,
            Q = R * h;
        return d[0] = 1 - g - L, d[1] = l + Q, d[2] = x - z, d[3] = 0, d[4] = l - Q, d[5] = 1 - p - L, d[6] = v + C, d[7] = 0, d[8] = x + z, d[9] = v - C, d[10] = 1 - p - g, d[11] = 0, d
    }

    function c(u, m) {
        const d = m ?? new t(12);
        return d[0] = -u[0], d[1] = -u[1], d[2] = -u[2], d[4] = -u[4], d[5] = -u[5], d[6] = -u[6], d[8] = -u[8], d[9] = -u[9], d[10] = -u[10], d
    }

    function f(u, m, d) {
        const w = d ?? new t(12);
        return w[0] = u[0] * m, w[1] = u[1] * m, w[2] = u[2] * m, w[4] = u[4] * m, w[5] = u[5] * m, w[6] = u[6] * m, w[8] = u[8] * m, w[9] = u[9] * m, w[10] = u[10] * m, w
    }
    const _ = f;

    function M(u, m, d) {
        const w = d ?? new t(12);
        return w[0] = u[0] + m[0], w[1] = u[1] + m[1], w[2] = u[2] + m[2], w[4] = u[4] + m[4], w[5] = u[5] + m[5], w[6] = u[6] + m[6], w[8] = u[8] + m[8], w[9] = u[9] + m[9], w[10] = u[10] + m[10], w
    }

    function A(u, m) {
        const d = m ?? new t(12);
        return d[0] = u[0], d[1] = u[1], d[2] = u[2], d[4] = u[4], d[5] = u[5], d[6] = u[6], d[8] = u[8], d[9] = u[9], d[10] = u[10], d
    }
    const I = A;

    function H(u, m) {
        return Math.abs(u[0] - m[0]) < we && Math.abs(u[1] - m[1]) < we && Math.abs(u[2] - m[2]) < we && Math.abs(u[4] - m[4]) < we && Math.abs(u[5] - m[5]) < we && Math.abs(u[6] - m[6]) < we && Math.abs(u[8] - m[8]) < we && Math.abs(u[9] - m[9]) < we && Math.abs(u[10] - m[10]) < we
    }

    function V(u, m) {
        return u[0] === m[0] && u[1] === m[1] && u[2] === m[2] && u[4] === m[4] && u[5] === m[5] && u[6] === m[6] && u[8] === m[8] && u[9] === m[9] && u[10] === m[10]
    }

    function G(u) {
        const m = u ?? new t(12);
        return m[0] = 1, m[1] = 0, m[2] = 0, m[4] = 0, m[5] = 1, m[6] = 0, m[8] = 0, m[9] = 0, m[10] = 1, m
    }

    function j(u, m) {
        const d = m ?? new t(12);
        if (d === u) {
            let g;
            return g = u[1], u[1] = u[4], u[4] = g, g = u[2], u[2] = u[8], u[8] = g, g = u[6], u[6] = u[9], u[9] = g, d
        }
        const w = u[0 * 4 + 0],
            E = u[0 * 4 + 1],
            S = u[0 * 4 + 2],
            R = u[1 * 4 + 0],
            a = u[1 * 4 + 1],
            y = u[1 * 4 + 2],
            h = u[2 * 4 + 0],
            p = u[2 * 4 + 1],
            l = u[2 * 4 + 2];
        return d[0] = w, d[1] = R, d[2] = h, d[4] = E, d[5] = a, d[6] = p, d[8] = S, d[9] = y, d[10] = l, d
    }

    function T(u, m) {
        const d = m ?? new t(12),
            w = u[0 * 4 + 0],
            E = u[0 * 4 + 1],
            S = u[0 * 4 + 2],
            R = u[1 * 4 + 0],
            a = u[1 * 4 + 1],
            y = u[1 * 4 + 2],
            h = u[2 * 4 + 0],
            p = u[2 * 4 + 1],
            l = u[2 * 4 + 2],
            g = l * a - y * p,
            x = -l * R + y * h,
            v = p * R - a * h,
            L = 1 / (w * g + E * x + S * v);
        return d[0] = g * L, d[1] = (-l * E + S * p) * L, d[2] = (y * E - S * a) * L, d[4] = x * L, d[5] = (l * w - S * h) * L, d[6] = (-y * w + S * R) * L, d[8] = v * L, d[9] = (-p * w + E * h) * L, d[10] = (a * w - E * R) * L, d
    }

    function Y(u) {
        const m = u[0],
            d = u[0 * 4 + 1],
            w = u[0 * 4 + 2],
            E = u[1 * 4 + 0],
            S = u[1 * 4 + 1],
            R = u[1 * 4 + 2],
            a = u[2 * 4 + 0],
            y = u[2 * 4 + 1],
            h = u[2 * 4 + 2];
        return m * (S * h - y * R) - E * (d * h - y * w) + a * (d * R - S * w)
    }
    const B = T;

    function F(u, m, d) {
        const w = d ?? new t(12),
            E = u[0],
            S = u[1],
            R = u[2],
            a = u[4],
            y = u[5],
            h = u[6],
            p = u[8],
            l = u[9],
            g = u[10],
            x = m[0],
            v = m[1],
            L = m[2],
            C = m[4],
            z = m[5],
            Q = m[6],
            J = m[8],
            Z = m[9],
            fe = m[10];
        return w[0] = E * x + a * v + p * L, w[1] = S * x + y * v + l * L, w[2] = R * x + h * v + g * L, w[4] = E * C + a * z + p * Q, w[5] = S * C + y * z + l * Q, w[6] = R * C + h * z + g * Q, w[8] = E * J + a * Z + p * fe, w[9] = S * J + y * Z + l * fe, w[10] = R * J + h * Z + g * fe, w
    }
    const D = F;

    function K(u, m, d) {
        const w = d ?? G();
        return u !== w && (w[0] = u[0], w[1] = u[1], w[2] = u[2], w[4] = u[4], w[5] = u[5], w[6] = u[6]), w[8] = m[0], w[9] = m[1], w[10] = 1, w
    }

    function P(u, m) {
        const d = m ?? e.create();
        return d[0] = u[8], d[1] = u[9], d
    }

    function U(u, m, d) {
        const w = d ?? e.create(),
            E = m * 4;
        return w[0] = u[E + 0], w[1] = u[E + 1], w
    }

    function X(u, m, d, w) {
        const E = w === u ? u : A(u, w),
            S = d * 4;
        return E[S + 0] = m[0], E[S + 1] = m[1], E
    }

    function $(u, m) {
        const d = m ?? e.create(),
            w = u[0],
            E = u[1],
            S = u[4],
            R = u[5];
        return d[0] = Math.sqrt(w * w + E * E), d[1] = Math.sqrt(S * S + R * R), d
    }

    function se(u, m) {
        const d = m ?? n.create(),
            w = u[0],
            E = u[1],
            S = u[2],
            R = u[4],
            a = u[5],
            y = u[6],
            h = u[8],
            p = u[9],
            l = u[10];
        return d[0] = Math.sqrt(w * w + E * E + S * S), d[1] = Math.sqrt(R * R + a * a + y * y), d[2] = Math.sqrt(h * h + p * p + l * l), d
    }

    function te(u, m) {
        const d = m ?? new t(12);
        return d[0] = 1, d[1] = 0, d[2] = 0, d[4] = 0, d[5] = 1, d[6] = 0, d[8] = u[0], d[9] = u[1], d[10] = 1, d
    }

    function ie(u, m, d) {
        const w = d ?? new t(12),
            E = m[0],
            S = m[1],
            R = u[0],
            a = u[1],
            y = u[2],
            h = u[1 * 4 + 0],
            p = u[1 * 4 + 1],
            l = u[1 * 4 + 2],
            g = u[2 * 4 + 0],
            x = u[2 * 4 + 1],
            v = u[2 * 4 + 2];
        return u !== w && (w[0] = R, w[1] = a, w[2] = y, w[4] = h, w[5] = p, w[6] = l), w[8] = R * E + h * S + g, w[9] = a * E + p * S + x, w[10] = y * E + l * S + v, w
    }

    function _e(u, m) {
        const d = m ?? new t(12),
            w = Math.cos(u),
            E = Math.sin(u);
        return d[0] = w, d[1] = E, d[2] = 0, d[4] = -E, d[5] = w, d[6] = 0, d[8] = 0, d[9] = 0, d[10] = 1, d
    }

    function ee(u, m, d) {
        const w = d ?? new t(12),
            E = u[0 * 4 + 0],
            S = u[0 * 4 + 1],
            R = u[0 * 4 + 2],
            a = u[1 * 4 + 0],
            y = u[1 * 4 + 1],
            h = u[1 * 4 + 2],
            p = Math.cos(m),
            l = Math.sin(m);
        return w[0] = p * E + l * a, w[1] = p * S + l * y, w[2] = p * R + l * h, w[4] = p * a - l * E, w[5] = p * y - l * S, w[6] = p * h - l * R, u !== w && (w[8] = u[8], w[9] = u[9], w[10] = u[10]), w
    }

    function ne(u, m) {
        const d = m ?? new t(12),
            w = Math.cos(u),
            E = Math.sin(u);
        return d[0] = 1, d[1] = 0, d[2] = 0, d[4] = 0, d[5] = w, d[6] = E, d[8] = 0, d[9] = -E, d[10] = w, d
    }

    function ce(u, m, d) {
        const w = d ?? new t(12),
            E = u[4],
            S = u[5],
            R = u[6],
            a = u[8],
            y = u[9],
            h = u[10],
            p = Math.cos(m),
            l = Math.sin(m);
        return w[4] = p * E + l * a, w[5] = p * S + l * y, w[6] = p * R + l * h, w[8] = p * a - l * E, w[9] = p * y - l * S, w[10] = p * h - l * R, u !== w && (w[0] = u[0], w[1] = u[1], w[2] = u[2]), w
    }

    function Ie(u, m) {
        const d = m ?? new t(12),
            w = Math.cos(u),
            E = Math.sin(u);
        return d[0] = w, d[1] = 0, d[2] = -E, d[4] = 0, d[5] = 1, d[6] = 0, d[8] = E, d[9] = 0, d[10] = w, d
    }

    function Fe(u, m, d) {
        const w = d ?? new t(12),
            E = u[0 * 4 + 0],
            S = u[0 * 4 + 1],
            R = u[0 * 4 + 2],
            a = u[2 * 4 + 0],
            y = u[2 * 4 + 1],
            h = u[2 * 4 + 2],
            p = Math.cos(m),
            l = Math.sin(m);
        return w[0] = p * E - l * a, w[1] = p * S - l * y, w[2] = p * R - l * h, w[8] = p * a + l * E, w[9] = p * y + l * S, w[10] = p * h + l * R, u !== w && (w[4] = u[4], w[5] = u[5], w[6] = u[6]), w
    }
    const Oe = _e,
        yt = ee;

    function rt(u, m) {
        const d = m ?? new t(12);
        return d[0] = u[0], d[1] = 0, d[2] = 0, d[4] = 0, d[5] = u[1], d[6] = 0, d[8] = 0, d[9] = 0, d[10] = 1, d
    }

    function Lt(u, m, d) {
        const w = d ?? new t(12),
            E = m[0],
            S = m[1];
        return w[0] = E * u[0 * 4 + 0], w[1] = E * u[0 * 4 + 1], w[2] = E * u[0 * 4 + 2], w[4] = S * u[1 * 4 + 0], w[5] = S * u[1 * 4 + 1], w[6] = S * u[1 * 4 + 2], u !== w && (w[8] = u[8], w[9] = u[9], w[10] = u[10]), w
    }

    function Ke(u, m) {
        const d = m ?? new t(12);
        return d[0] = u[0], d[1] = 0, d[2] = 0, d[4] = 0, d[5] = u[1], d[6] = 0, d[8] = 0, d[9] = 0, d[10] = u[2], d
    }

    function Mt(u, m, d) {
        const w = d ?? new t(12),
            E = m[0],
            S = m[1],
            R = m[2];
        return w[0] = E * u[0 * 4 + 0], w[1] = E * u[0 * 4 + 1], w[2] = E * u[0 * 4 + 2], w[4] = S * u[1 * 4 + 0], w[5] = S * u[1 * 4 + 1], w[6] = S * u[1 * 4 + 2], w[8] = R * u[2 * 4 + 0], w[9] = R * u[2 * 4 + 1], w[10] = R * u[2 * 4 + 2], w
    }

    function ut(u, m) {
        const d = m ?? new t(12);
        return d[0] = u, d[1] = 0, d[2] = 0, d[4] = 0, d[5] = u, d[6] = 0, d[8] = 0, d[9] = 0, d[10] = 1, d
    }

    function O(u, m, d) {
        const w = d ?? new t(12);
        return w[0] = m * u[0 * 4 + 0], w[1] = m * u[0 * 4 + 1], w[2] = m * u[0 * 4 + 2], w[4] = m * u[1 * 4 + 0], w[5] = m * u[1 * 4 + 1], w[6] = m * u[1 * 4 + 2], u !== w && (w[8] = u[8], w[9] = u[9], w[10] = u[10]), w
    }

    function W(u, m) {
        const d = m ?? new t(12);
        return d[0] = u, d[1] = 0, d[2] = 0, d[4] = 0, d[5] = u, d[6] = 0, d[8] = 0, d[9] = 0, d[10] = u, d
    }

    function b(u, m, d) {
        const w = d ?? new t(12);
        return w[0] = m * u[0 * 4 + 0], w[1] = m * u[0 * 4 + 1], w[2] = m * u[0 * 4 + 2], w[4] = m * u[1 * 4 + 0], w[5] = m * u[1 * 4 + 1], w[6] = m * u[1 * 4 + 2], w[8] = m * u[2 * 4 + 0], w[9] = m * u[2 * 4 + 1], w[10] = m * u[2 * 4 + 2], w
    }
    return {
        add: M,
        clone: I,
        copy: A,
        create: s,
        determinant: Y,
        equals: V,
        equalsApproximately: H,
        fromMat4: i,
        fromQuat: o,
        get3DScaling: se,
        getAxis: U,
        getScaling: $,
        getTranslation: P,
        identity: G,
        inverse: T,
        invert: B,
        mul: D,
        mulScalar: _,
        multiply: F,
        multiplyScalar: f,
        negate: c,
        rotate: ee,
        rotateX: ce,
        rotateY: Fe,
        rotateZ: yt,
        rotation: _e,
        rotationX: ne,
        rotationY: Ie,
        rotationZ: Oe,
        scale: Lt,
        scale3D: Mt,
        scaling: rt,
        scaling3D: Ke,
        set: r,
        setAxis: X,
        setTranslation: K,
        translate: ie,
        translation: te,
        transpose: j,
        uniformScale: O,
        uniformScale3D: b,
        uniformScaling: ut,
        uniformScaling3D: W
    }
}
const Ga = new Map;

function J1(t) {
    let e = Ga.get(t);
    return e || (e = K1(t), Ga.set(t, e)), e
}

function Z1(t) {
    const e = Qr(t);

    function n(a, y, h, p, l, g, x, v, L, C, z, Q, J, Z, fe, me) {
        const he = new t(16);
        return a !== void 0 && (he[0] = a, y !== void 0 && (he[1] = y, h !== void 0 && (he[2] = h, p !== void 0 && (he[3] = p, l !== void 0 && (he[4] = l, g !== void 0 && (he[5] = g, x !== void 0 && (he[6] = x, v !== void 0 && (he[7] = v, L !== void 0 && (he[8] = L, C !== void 0 && (he[9] = C, z !== void 0 && (he[10] = z, Q !== void 0 && (he[11] = Q, J !== void 0 && (he[12] = J, Z !== void 0 && (he[13] = Z, fe !== void 0 && (he[14] = fe, me !== void 0 && (he[15] = me)))))))))))))))), he
    }

    function s(a, y, h, p, l, g, x, v, L, C, z, Q, J, Z, fe, me, he) {
        const ge = he ?? new t(16);
        return ge[0] = a, ge[1] = y, ge[2] = h, ge[3] = p, ge[4] = l, ge[5] = g, ge[6] = x, ge[7] = v, ge[8] = L, ge[9] = C, ge[10] = z, ge[11] = Q, ge[12] = J, ge[13] = Z, ge[14] = fe, ge[15] = me, ge
    }

    function r(a, y) {
        const h = y ?? new t(16);
        return h[0] = a[0], h[1] = a[1], h[2] = a[2], h[3] = 0, h[4] = a[4], h[5] = a[5], h[6] = a[6], h[7] = 0, h[8] = a[8], h[9] = a[9], h[10] = a[10], h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function i(a, y) {
        const h = y ?? new t(16),
            p = a[0],
            l = a[1],
            g = a[2],
            x = a[3],
            v = p + p,
            L = l + l,
            C = g + g,
            z = p * v,
            Q = l * v,
            J = l * L,
            Z = g * v,
            fe = g * L,
            me = g * C,
            he = x * v,
            ge = x * L,
            Re = x * C;
        return h[0] = 1 - J - me, h[1] = Q + Re, h[2] = Z - ge, h[3] = 0, h[4] = Q - Re, h[5] = 1 - z - me, h[6] = fe + he, h[7] = 0, h[8] = Z + ge, h[9] = fe - he, h[10] = 1 - z - J, h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function o(a, y) {
        const h = y ?? new t(16);
        return h[0] = -a[0], h[1] = -a[1], h[2] = -a[2], h[3] = -a[3], h[4] = -a[4], h[5] = -a[5], h[6] = -a[6], h[7] = -a[7], h[8] = -a[8], h[9] = -a[9], h[10] = -a[10], h[11] = -a[11], h[12] = -a[12], h[13] = -a[13], h[14] = -a[14], h[15] = -a[15], h
    }

    function c(a, y, h) {
        const p = h ?? new t(16);
        return p[0] = a[0] + y[0], p[1] = a[1] + y[1], p[2] = a[2] + y[2], p[3] = a[3] + y[3], p[4] = a[4] + y[4], p[5] = a[5] + y[5], p[6] = a[6] + y[6], p[7] = a[7] + y[7], p[8] = a[8] + y[8], p[9] = a[9] + y[9], p[10] = a[10] + y[10], p[11] = a[11] + y[11], p[12] = a[12] + y[12], p[13] = a[13] + y[13], p[14] = a[14] + y[14], p[15] = a[15] + y[15], p
    }

    function f(a, y, h) {
        const p = h ?? new t(16);
        return p[0] = a[0] * y, p[1] = a[1] * y, p[2] = a[2] * y, p[3] = a[3] * y, p[4] = a[4] * y, p[5] = a[5] * y, p[6] = a[6] * y, p[7] = a[7] * y, p[8] = a[8] * y, p[9] = a[9] * y, p[10] = a[10] * y, p[11] = a[11] * y, p[12] = a[12] * y, p[13] = a[13] * y, p[14] = a[14] * y, p[15] = a[15] * y, p
    }
    const _ = f;

    function M(a, y) {
        const h = y ?? new t(16);
        return h[0] = a[0], h[1] = a[1], h[2] = a[2], h[3] = a[3], h[4] = a[4], h[5] = a[5], h[6] = a[6], h[7] = a[7], h[8] = a[8], h[9] = a[9], h[10] = a[10], h[11] = a[11], h[12] = a[12], h[13] = a[13], h[14] = a[14], h[15] = a[15], h
    }
    const A = M;

    function I(a, y) {
        return Math.abs(a[0] - y[0]) < we && Math.abs(a[1] - y[1]) < we && Math.abs(a[2] - y[2]) < we && Math.abs(a[3] - y[3]) < we && Math.abs(a[4] - y[4]) < we && Math.abs(a[5] - y[5]) < we && Math.abs(a[6] - y[6]) < we && Math.abs(a[7] - y[7]) < we && Math.abs(a[8] - y[8]) < we && Math.abs(a[9] - y[9]) < we && Math.abs(a[10] - y[10]) < we && Math.abs(a[11] - y[11]) < we && Math.abs(a[12] - y[12]) < we && Math.abs(a[13] - y[13]) < we && Math.abs(a[14] - y[14]) < we && Math.abs(a[15] - y[15]) < we
    }

    function H(a, y) {
        return a[0] === y[0] && a[1] === y[1] && a[2] === y[2] && a[3] === y[3] && a[4] === y[4] && a[5] === y[5] && a[6] === y[6] && a[7] === y[7] && a[8] === y[8] && a[9] === y[9] && a[10] === y[10] && a[11] === y[11] && a[12] === y[12] && a[13] === y[13] && a[14] === y[14] && a[15] === y[15]
    }

    function V(a) {
        const y = a ?? new t(16);
        return y[0] = 1, y[1] = 0, y[2] = 0, y[3] = 0, y[4] = 0, y[5] = 1, y[6] = 0, y[7] = 0, y[8] = 0, y[9] = 0, y[10] = 1, y[11] = 0, y[12] = 0, y[13] = 0, y[14] = 0, y[15] = 1, y
    }

    function G(a, y) {
        const h = y ?? new t(16);
        if (h === a) {
            let Ae;
            return Ae = a[1], a[1] = a[4], a[4] = Ae, Ae = a[2], a[2] = a[8], a[8] = Ae, Ae = a[3], a[3] = a[12], a[12] = Ae, Ae = a[6], a[6] = a[9], a[9] = Ae, Ae = a[7], a[7] = a[13], a[13] = Ae, Ae = a[11], a[11] = a[14], a[14] = Ae, h
        }
        const p = a[0 * 4 + 0],
            l = a[0 * 4 + 1],
            g = a[0 * 4 + 2],
            x = a[0 * 4 + 3],
            v = a[1 * 4 + 0],
            L = a[1 * 4 + 1],
            C = a[1 * 4 + 2],
            z = a[1 * 4 + 3],
            Q = a[2 * 4 + 0],
            J = a[2 * 4 + 1],
            Z = a[2 * 4 + 2],
            fe = a[2 * 4 + 3],
            me = a[3 * 4 + 0],
            he = a[3 * 4 + 1],
            ge = a[3 * 4 + 2],
            Re = a[3 * 4 + 3];
        return h[0] = p, h[1] = v, h[2] = Q, h[3] = me, h[4] = l, h[5] = L, h[6] = J, h[7] = he, h[8] = g, h[9] = C, h[10] = Z, h[11] = ge, h[12] = x, h[13] = z, h[14] = fe, h[15] = Re, h
    }

    function j(a, y) {
        const h = y ?? new t(16),
            p = a[0 * 4 + 0],
            l = a[0 * 4 + 1],
            g = a[0 * 4 + 2],
            x = a[0 * 4 + 3],
            v = a[1 * 4 + 0],
            L = a[1 * 4 + 1],
            C = a[1 * 4 + 2],
            z = a[1 * 4 + 3],
            Q = a[2 * 4 + 0],
            J = a[2 * 4 + 1],
            Z = a[2 * 4 + 2],
            fe = a[2 * 4 + 3],
            me = a[3 * 4 + 0],
            he = a[3 * 4 + 1],
            ge = a[3 * 4 + 2],
            Re = a[3 * 4 + 3],
            Ae = Z * Re,
            et = ge * fe,
            tt = C * Re,
            nt = ge * z,
            ct = C * fe,
            lt = Z * z,
            ft = g * Re,
            ht = ge * x,
            dt = g * fe,
            pt = Z * x,
            _t = g * z,
            wt = C * x,
            vt = Q * he,
            bt = me * J,
            Nt = v * he,
            kt = me * L,
            Ut = v * J,
            pr = Q * L,
            gr = p * he,
            mr = me * l,
            yr = p * J,
            _r = Q * l,
            wr = p * L,
            vr = v * l,
            Na = Ae * L + nt * J + ct * he - (et * L + tt * J + lt * he),
            ka = et * l + ft * J + pt * he - (Ae * l + ht * J + dt * he),
            Ua = tt * l + ht * L + _t * he - (nt * l + ft * L + wt * he),
            Fa = lt * l + dt * L + wt * J - (ct * l + pt * L + _t * J),
            gt = 1 / (p * Na + v * ka + Q * Ua + me * Fa);
        return h[0] = gt * Na, h[1] = gt * ka, h[2] = gt * Ua, h[3] = gt * Fa, h[4] = gt * (et * v + tt * Q + lt * me - (Ae * v + nt * Q + ct * me)), h[5] = gt * (Ae * p + ht * Q + dt * me - (et * p + ft * Q + pt * me)), h[6] = gt * (nt * p + ft * v + wt * me - (tt * p + ht * v + _t * me)), h[7] = gt * (ct * p + pt * v + _t * Q - (lt * p + dt * v + wt * Q)), h[8] = gt * (vt * z + kt * fe + Ut * Re - (bt * z + Nt * fe + pr * Re)), h[9] = gt * (bt * x + gr * fe + _r * Re - (vt * x + mr * fe + yr * Re)), h[10] = gt * (Nt * x + mr * z + wr * Re - (kt * x + gr * z + vr * Re)), h[11] = gt * (pr * x + yr * z + vr * fe - (Ut * x + _r * z + wr * fe)), h[12] = gt * (Nt * Z + pr * ge + bt * C - (Ut * ge + vt * C + kt * Z)), h[13] = gt * (yr * ge + vt * g + mr * Z - (gr * Z + _r * ge + bt * g)), h[14] = gt * (gr * C + vr * ge + kt * g - (wr * ge + Nt * g + mr * C)), h[15] = gt * (wr * Z + Ut * g + _r * C - (yr * C + vr * Z + pr * g)), h
    }

    function T(a) {
        const y = a[0],
            h = a[0 * 4 + 1],
            p = a[0 * 4 + 2],
            l = a[0 * 4 + 3],
            g = a[1 * 4 + 0],
            x = a[1 * 4 + 1],
            v = a[1 * 4 + 2],
            L = a[1 * 4 + 3],
            C = a[2 * 4 + 0],
            z = a[2 * 4 + 1],
            Q = a[2 * 4 + 2],
            J = a[2 * 4 + 3],
            Z = a[3 * 4 + 0],
            fe = a[3 * 4 + 1],
            me = a[3 * 4 + 2],
            he = a[3 * 4 + 3],
            ge = Q * he,
            Re = me * J,
            Ae = v * he,
            et = me * L,
            tt = v * J,
            nt = Q * L,
            ct = p * he,
            lt = me * l,
            ft = p * J,
            ht = Q * l,
            dt = p * L,
            pt = v * l,
            _t = ge * x + et * z + tt * fe - (Re * x + Ae * z + nt * fe),
            wt = Re * h + ct * z + ht * fe - (ge * h + lt * z + ft * fe),
            vt = Ae * h + lt * x + dt * fe - (et * h + ct * x + pt * fe),
            bt = nt * h + ft * x + pt * z - (tt * h + ht * x + dt * z);
        return y * _t + g * wt + C * vt + Z * bt
    }
    const Y = j;

    function B(a, y, h) {
        const p = h ?? new t(16),
            l = a[0],
            g = a[1],
            x = a[2],
            v = a[3],
            L = a[4],
            C = a[5],
            z = a[6],
            Q = a[7],
            J = a[8],
            Z = a[9],
            fe = a[10],
            me = a[11],
            he = a[12],
            ge = a[13],
            Re = a[14],
            Ae = a[15],
            et = y[0],
            tt = y[1],
            nt = y[2],
            ct = y[3],
            lt = y[4],
            ft = y[5],
            ht = y[6],
            dt = y[7],
            pt = y[8],
            _t = y[9],
            wt = y[10],
            vt = y[11],
            bt = y[12],
            Nt = y[13],
            kt = y[14],
            Ut = y[15];
        return p[0] = l * et + L * tt + J * nt + he * ct, p[1] = g * et + C * tt + Z * nt + ge * ct, p[2] = x * et + z * tt + fe * nt + Re * ct, p[3] = v * et + Q * tt + me * nt + Ae * ct, p[4] = l * lt + L * ft + J * ht + he * dt, p[5] = g * lt + C * ft + Z * ht + ge * dt, p[6] = x * lt + z * ft + fe * ht + Re * dt, p[7] = v * lt + Q * ft + me * ht + Ae * dt, p[8] = l * pt + L * _t + J * wt + he * vt, p[9] = g * pt + C * _t + Z * wt + ge * vt, p[10] = x * pt + z * _t + fe * wt + Re * vt, p[11] = v * pt + Q * _t + me * wt + Ae * vt, p[12] = l * bt + L * Nt + J * kt + he * Ut, p[13] = g * bt + C * Nt + Z * kt + ge * Ut, p[14] = x * bt + z * Nt + fe * kt + Re * Ut, p[15] = v * bt + Q * Nt + me * kt + Ae * Ut, p
    }
    const F = B;

    function D(a, y, h) {
        const p = h ?? V();
        return a !== p && (p[0] = a[0], p[1] = a[1], p[2] = a[2], p[3] = a[3], p[4] = a[4], p[5] = a[5], p[6] = a[6], p[7] = a[7], p[8] = a[8], p[9] = a[9], p[10] = a[10], p[11] = a[11]), p[12] = y[0], p[13] = y[1], p[14] = y[2], p[15] = 1, p
    }

    function K(a, y) {
        const h = y ?? e.create();
        return h[0] = a[12], h[1] = a[13], h[2] = a[14], h
    }

    function P(a, y, h) {
        const p = h ?? e.create(),
            l = y * 4;
        return p[0] = a[l + 0], p[1] = a[l + 1], p[2] = a[l + 2], p
    }

    function U(a, y, h, p) {
        const l = p === a ? p : M(a, p),
            g = h * 4;
        return l[g + 0] = y[0], l[g + 1] = y[1], l[g + 2] = y[2], l
    }

    function X(a, y) {
        const h = y ?? e.create(),
            p = a[0],
            l = a[1],
            g = a[2],
            x = a[4],
            v = a[5],
            L = a[6],
            C = a[8],
            z = a[9],
            Q = a[10];
        return h[0] = Math.sqrt(p * p + l * l + g * g), h[1] = Math.sqrt(x * x + v * v + L * L), h[2] = Math.sqrt(C * C + z * z + Q * Q), h
    }

    function $(a, y, h, p, l) {
        const g = l ?? new t(16),
            x = Math.tan(Math.PI * .5 - .5 * a);
        if (g[0] = x / y, g[1] = 0, g[2] = 0, g[3] = 0, g[4] = 0, g[5] = x, g[6] = 0, g[7] = 0, g[8] = 0, g[9] = 0, g[11] = -1, g[12] = 0, g[13] = 0, g[15] = 0, Number.isFinite(p)) {
            const v = 1 / (h - p);
            g[10] = p * v, g[14] = p * h * v
        } else g[10] = -1, g[14] = -h;
        return g
    }

    function se(a, y, h, p = 1 / 0, l) {
        const g = l ?? new t(16),
            x = 1 / Math.tan(a * .5);
        if (g[0] = x / y, g[1] = 0, g[2] = 0, g[3] = 0, g[4] = 0, g[5] = x, g[6] = 0, g[7] = 0, g[8] = 0, g[9] = 0, g[11] = -1, g[12] = 0, g[13] = 0, g[15] = 0, p === 1 / 0) g[10] = 0, g[14] = h;
        else {
            const v = 1 / (p - h);
            g[10] = h * v, g[14] = p * h * v
        }
        return g
    }

    function te(a, y, h, p, l, g, x) {
        const v = x ?? new t(16);
        return v[0] = 2 / (y - a), v[1] = 0, v[2] = 0, v[3] = 0, v[4] = 0, v[5] = 2 / (p - h), v[6] = 0, v[7] = 0, v[8] = 0, v[9] = 0, v[10] = 1 / (l - g), v[11] = 0, v[12] = (y + a) / (a - y), v[13] = (p + h) / (h - p), v[14] = l / (l - g), v[15] = 1, v
    }

    function ie(a, y, h, p, l, g, x) {
        const v = x ?? new t(16),
            L = y - a,
            C = p - h,
            z = l - g;
        return v[0] = 2 * l / L, v[1] = 0, v[2] = 0, v[3] = 0, v[4] = 0, v[5] = 2 * l / C, v[6] = 0, v[7] = 0, v[8] = (a + y) / L, v[9] = (p + h) / C, v[10] = g / z, v[11] = -1, v[12] = 0, v[13] = 0, v[14] = l * g / z, v[15] = 0, v
    }

    function _e(a, y, h, p, l, g = 1 / 0, x) {
        const v = x ?? new t(16),
            L = y - a,
            C = p - h;
        if (v[0] = 2 * l / L, v[1] = 0, v[2] = 0, v[3] = 0, v[4] = 0, v[5] = 2 * l / C, v[6] = 0, v[7] = 0, v[8] = (a + y) / L, v[9] = (p + h) / C, v[11] = -1, v[12] = 0, v[13] = 0, v[15] = 0, g === 1 / 0) v[10] = 0, v[14] = l;
        else {
            const z = 1 / (g - l);
            v[10] = l * z, v[14] = g * l * z
        }
        return v
    }
    const ee = e.create(),
        ne = e.create(),
        ce = e.create();

    function Ie(a, y, h, p) {
        const l = p ?? new t(16);
        return e.normalize(e.subtract(y, a, ce), ce), e.normalize(e.cross(h, ce, ee), ee), e.normalize(e.cross(ce, ee, ne), ne), l[0] = ee[0], l[1] = ee[1], l[2] = ee[2], l[3] = 0, l[4] = ne[0], l[5] = ne[1], l[6] = ne[2], l[7] = 0, l[8] = ce[0], l[9] = ce[1], l[10] = ce[2], l[11] = 0, l[12] = a[0], l[13] = a[1], l[14] = a[2], l[15] = 1, l
    }

    function Fe(a, y, h, p) {
        const l = p ?? new t(16);
        return e.normalize(e.subtract(a, y, ce), ce), e.normalize(e.cross(h, ce, ee), ee), e.normalize(e.cross(ce, ee, ne), ne), l[0] = ee[0], l[1] = ee[1], l[2] = ee[2], l[3] = 0, l[4] = ne[0], l[5] = ne[1], l[6] = ne[2], l[7] = 0, l[8] = ce[0], l[9] = ce[1], l[10] = ce[2], l[11] = 0, l[12] = a[0], l[13] = a[1], l[14] = a[2], l[15] = 1, l
    }

    function Oe(a, y, h, p) {
        const l = p ?? new t(16);
        return e.normalize(e.subtract(a, y, ce), ce), e.normalize(e.cross(h, ce, ee), ee), e.normalize(e.cross(ce, ee, ne), ne), l[0] = ee[0], l[1] = ne[0], l[2] = ce[0], l[3] = 0, l[4] = ee[1], l[5] = ne[1], l[6] = ce[1], l[7] = 0, l[8] = ee[2], l[9] = ne[2], l[10] = ce[2], l[11] = 0, l[12] = -(ee[0] * a[0] + ee[1] * a[1] + ee[2] * a[2]), l[13] = -(ne[0] * a[0] + ne[1] * a[1] + ne[2] * a[2]), l[14] = -(ce[0] * a[0] + ce[1] * a[1] + ce[2] * a[2]), l[15] = 1, l
    }

    function yt(a, y) {
        const h = y ?? new t(16);
        return h[0] = 1, h[1] = 0, h[2] = 0, h[3] = 0, h[4] = 0, h[5] = 1, h[6] = 0, h[7] = 0, h[8] = 0, h[9] = 0, h[10] = 1, h[11] = 0, h[12] = a[0], h[13] = a[1], h[14] = a[2], h[15] = 1, h
    }

    function rt(a, y, h) {
        const p = h ?? new t(16),
            l = y[0],
            g = y[1],
            x = y[2],
            v = a[0],
            L = a[1],
            C = a[2],
            z = a[3],
            Q = a[1 * 4 + 0],
            J = a[1 * 4 + 1],
            Z = a[1 * 4 + 2],
            fe = a[1 * 4 + 3],
            me = a[2 * 4 + 0],
            he = a[2 * 4 + 1],
            ge = a[2 * 4 + 2],
            Re = a[2 * 4 + 3],
            Ae = a[3 * 4 + 0],
            et = a[3 * 4 + 1],
            tt = a[3 * 4 + 2],
            nt = a[3 * 4 + 3];
        return a !== p && (p[0] = v, p[1] = L, p[2] = C, p[3] = z, p[4] = Q, p[5] = J, p[6] = Z, p[7] = fe, p[8] = me, p[9] = he, p[10] = ge, p[11] = Re), p[12] = v * l + Q * g + me * x + Ae, p[13] = L * l + J * g + he * x + et, p[14] = C * l + Z * g + ge * x + tt, p[15] = z * l + fe * g + Re * x + nt, p
    }

    function Lt(a, y) {
        const h = y ?? new t(16),
            p = Math.cos(a),
            l = Math.sin(a);
        return h[0] = 1, h[1] = 0, h[2] = 0, h[3] = 0, h[4] = 0, h[5] = p, h[6] = l, h[7] = 0, h[8] = 0, h[9] = -l, h[10] = p, h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function Ke(a, y, h) {
        const p = h ?? new t(16),
            l = a[4],
            g = a[5],
            x = a[6],
            v = a[7],
            L = a[8],
            C = a[9],
            z = a[10],
            Q = a[11],
            J = Math.cos(y),
            Z = Math.sin(y);
        return p[4] = J * l + Z * L, p[5] = J * g + Z * C, p[6] = J * x + Z * z, p[7] = J * v + Z * Q, p[8] = J * L - Z * l, p[9] = J * C - Z * g, p[10] = J * z - Z * x, p[11] = J * Q - Z * v, a !== p && (p[0] = a[0], p[1] = a[1], p[2] = a[2], p[3] = a[3], p[12] = a[12], p[13] = a[13], p[14] = a[14], p[15] = a[15]), p
    }

    function Mt(a, y) {
        const h = y ?? new t(16),
            p = Math.cos(a),
            l = Math.sin(a);
        return h[0] = p, h[1] = 0, h[2] = -l, h[3] = 0, h[4] = 0, h[5] = 1, h[6] = 0, h[7] = 0, h[8] = l, h[9] = 0, h[10] = p, h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function ut(a, y, h) {
        const p = h ?? new t(16),
            l = a[0 * 4 + 0],
            g = a[0 * 4 + 1],
            x = a[0 * 4 + 2],
            v = a[0 * 4 + 3],
            L = a[2 * 4 + 0],
            C = a[2 * 4 + 1],
            z = a[2 * 4 + 2],
            Q = a[2 * 4 + 3],
            J = Math.cos(y),
            Z = Math.sin(y);
        return p[0] = J * l - Z * L, p[1] = J * g - Z * C, p[2] = J * x - Z * z, p[3] = J * v - Z * Q, p[8] = J * L + Z * l, p[9] = J * C + Z * g, p[10] = J * z + Z * x, p[11] = J * Q + Z * v, a !== p && (p[4] = a[4], p[5] = a[5], p[6] = a[6], p[7] = a[7], p[12] = a[12], p[13] = a[13], p[14] = a[14], p[15] = a[15]), p
    }

    function O(a, y) {
        const h = y ?? new t(16),
            p = Math.cos(a),
            l = Math.sin(a);
        return h[0] = p, h[1] = l, h[2] = 0, h[3] = 0, h[4] = -l, h[5] = p, h[6] = 0, h[7] = 0, h[8] = 0, h[9] = 0, h[10] = 1, h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function W(a, y, h) {
        const p = h ?? new t(16),
            l = a[0 * 4 + 0],
            g = a[0 * 4 + 1],
            x = a[0 * 4 + 2],
            v = a[0 * 4 + 3],
            L = a[1 * 4 + 0],
            C = a[1 * 4 + 1],
            z = a[1 * 4 + 2],
            Q = a[1 * 4 + 3],
            J = Math.cos(y),
            Z = Math.sin(y);
        return p[0] = J * l + Z * L, p[1] = J * g + Z * C, p[2] = J * x + Z * z, p[3] = J * v + Z * Q, p[4] = J * L - Z * l, p[5] = J * C - Z * g, p[6] = J * z - Z * x, p[7] = J * Q - Z * v, a !== p && (p[8] = a[8], p[9] = a[9], p[10] = a[10], p[11] = a[11], p[12] = a[12], p[13] = a[13], p[14] = a[14], p[15] = a[15]), p
    }

    function b(a, y, h) {
        const p = h ?? new t(16);
        let l = a[0],
            g = a[1],
            x = a[2];
        const v = Math.sqrt(l * l + g * g + x * x);
        l /= v, g /= v, x /= v;
        const L = l * l,
            C = g * g,
            z = x * x,
            Q = Math.cos(y),
            J = Math.sin(y),
            Z = 1 - Q;
        return p[0] = L + (1 - L) * Q, p[1] = l * g * Z + x * J, p[2] = l * x * Z - g * J, p[3] = 0, p[4] = l * g * Z - x * J, p[5] = C + (1 - C) * Q, p[6] = g * x * Z + l * J, p[7] = 0, p[8] = l * x * Z + g * J, p[9] = g * x * Z - l * J, p[10] = z + (1 - z) * Q, p[11] = 0, p[12] = 0, p[13] = 0, p[14] = 0, p[15] = 1, p
    }
    const u = b;

    function m(a, y, h, p) {
        const l = p ?? new t(16);
        let g = y[0],
            x = y[1],
            v = y[2];
        const L = Math.sqrt(g * g + x * x + v * v);
        g /= L, x /= L, v /= L;
        const C = g * g,
            z = x * x,
            Q = v * v,
            J = Math.cos(h),
            Z = Math.sin(h),
            fe = 1 - J,
            me = C + (1 - C) * J,
            he = g * x * fe + v * Z,
            ge = g * v * fe - x * Z,
            Re = g * x * fe - v * Z,
            Ae = z + (1 - z) * J,
            et = x * v * fe + g * Z,
            tt = g * v * fe + x * Z,
            nt = x * v * fe - g * Z,
            ct = Q + (1 - Q) * J,
            lt = a[0],
            ft = a[1],
            ht = a[2],
            dt = a[3],
            pt = a[4],
            _t = a[5],
            wt = a[6],
            vt = a[7],
            bt = a[8],
            Nt = a[9],
            kt = a[10],
            Ut = a[11];
        return l[0] = me * lt + he * pt + ge * bt, l[1] = me * ft + he * _t + ge * Nt, l[2] = me * ht + he * wt + ge * kt, l[3] = me * dt + he * vt + ge * Ut, l[4] = Re * lt + Ae * pt + et * bt, l[5] = Re * ft + Ae * _t + et * Nt, l[6] = Re * ht + Ae * wt + et * kt, l[7] = Re * dt + Ae * vt + et * Ut, l[8] = tt * lt + nt * pt + ct * bt, l[9] = tt * ft + nt * _t + ct * Nt, l[10] = tt * ht + nt * wt + ct * kt, l[11] = tt * dt + nt * vt + ct * Ut, a !== l && (l[12] = a[12], l[13] = a[13], l[14] = a[14], l[15] = a[15]), l
    }
    const d = m;

    function w(a, y) {
        const h = y ?? new t(16);
        return h[0] = a[0], h[1] = 0, h[2] = 0, h[3] = 0, h[4] = 0, h[5] = a[1], h[6] = 0, h[7] = 0, h[8] = 0, h[9] = 0, h[10] = a[2], h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function E(a, y, h) {
        const p = h ?? new t(16),
            l = y[0],
            g = y[1],
            x = y[2];
        return p[0] = l * a[0 * 4 + 0], p[1] = l * a[0 * 4 + 1], p[2] = l * a[0 * 4 + 2], p[3] = l * a[0 * 4 + 3], p[4] = g * a[1 * 4 + 0], p[5] = g * a[1 * 4 + 1], p[6] = g * a[1 * 4 + 2], p[7] = g * a[1 * 4 + 3], p[8] = x * a[2 * 4 + 0], p[9] = x * a[2 * 4 + 1], p[10] = x * a[2 * 4 + 2], p[11] = x * a[2 * 4 + 3], a !== p && (p[12] = a[12], p[13] = a[13], p[14] = a[14], p[15] = a[15]), p
    }

    function S(a, y) {
        const h = y ?? new t(16);
        return h[0] = a, h[1] = 0, h[2] = 0, h[3] = 0, h[4] = 0, h[5] = a, h[6] = 0, h[7] = 0, h[8] = 0, h[9] = 0, h[10] = a, h[11] = 0, h[12] = 0, h[13] = 0, h[14] = 0, h[15] = 1, h
    }

    function R(a, y, h) {
        const p = h ?? new t(16);
        return p[0] = y * a[0 * 4 + 0], p[1] = y * a[0 * 4 + 1], p[2] = y * a[0 * 4 + 2], p[3] = y * a[0 * 4 + 3], p[4] = y * a[1 * 4 + 0], p[5] = y * a[1 * 4 + 1], p[6] = y * a[1 * 4 + 2], p[7] = y * a[1 * 4 + 3], p[8] = y * a[2 * 4 + 0], p[9] = y * a[2 * 4 + 1], p[10] = y * a[2 * 4 + 2], p[11] = y * a[2 * 4 + 3], a !== p && (p[12] = a[12], p[13] = a[13], p[14] = a[14], p[15] = a[15]), p
    }
    return {
        add: c,
        aim: Ie,
        axisRotate: m,
        axisRotation: b,
        cameraAim: Fe,
        clone: A,
        copy: M,
        create: n,
        determinant: T,
        equals: H,
        equalsApproximately: I,
        fromMat3: r,
        fromQuat: i,
        frustum: ie,
        frustumReverseZ: _e,
        getAxis: P,
        getScaling: X,
        getTranslation: K,
        identity: V,
        inverse: j,
        invert: Y,
        lookAt: Oe,
        mul: F,
        mulScalar: _,
        multiply: B,
        multiplyScalar: f,
        negate: o,
        ortho: te,
        perspective: $,
        perspectiveReverseZ: se,
        rotate: d,
        rotateX: Ke,
        rotateY: ut,
        rotateZ: W,
        rotation: u,
        rotationX: Lt,
        rotationY: Mt,
        rotationZ: O,
        scale: E,
        scaling: w,
        set: s,
        setAxis: U,
        setTranslation: D,
        translate: rt,
        translation: yt,
        transpose: G,
        uniformScale: R,
        uniformScaling: S
    }
}
const Va = new Map;

function Q1(t) {
    let e = Va.get(t);
    return e || (e = Z1(t), Va.set(t, e)), e
}

function ef(t) {
    const e = Qr(t);

    function n(O, W, b, u) {
        const m = new t(4);
        return O !== void 0 && (m[0] = O, W !== void 0 && (m[1] = W, b !== void 0 && (m[2] = b, u !== void 0 && (m[3] = u)))), m
    }
    const s = n;

    function r(O, W, b, u, m) {
        const d = m ?? new t(4);
        return d[0] = O, d[1] = W, d[2] = b, d[3] = u, d
    }

    function i(O, W, b) {
        const u = b ?? new t(4),
            m = W * .5,
            d = Math.sin(m);
        return u[0] = d * O[0], u[1] = d * O[1], u[2] = d * O[2], u[3] = Math.cos(m), u
    }

    function o(O, W) {
        const b = W ?? e.create(3),
            u = Math.acos(O[3]) * 2,
            m = Math.sin(u * .5);
        return m > we ? (b[0] = O[0] / m, b[1] = O[1] / m, b[2] = O[2] / m) : (b[0] = 1, b[1] = 0, b[2] = 0), {
            angle: u,
            axis: b
        }
    }

    function c(O, W) {
        const b = $(O, W);
        return Math.acos(2 * b * b - 1)
    }

    function f(O, W, b) {
        const u = b ?? new t(4),
            m = O[0],
            d = O[1],
            w = O[2],
            E = O[3],
            S = W[0],
            R = W[1],
            a = W[2],
            y = W[3];
        return u[0] = m * y + E * S + d * a - w * R, u[1] = d * y + E * R + w * S - m * a, u[2] = w * y + E * a + m * R - d * S, u[3] = E * y - m * S - d * R - w * a, u
    }
    const _ = f;

    function M(O, W, b) {
        const u = b ?? new t(4),
            m = W * .5,
            d = O[0],
            w = O[1],
            E = O[2],
            S = O[3],
            R = Math.sin(m),
            a = Math.cos(m);
        return u[0] = d * a + S * R, u[1] = w * a + E * R, u[2] = E * a - w * R, u[3] = S * a - d * R, u
    }

    function A(O, W, b) {
        const u = b ?? new t(4),
            m = W * .5,
            d = O[0],
            w = O[1],
            E = O[2],
            S = O[3],
            R = Math.sin(m),
            a = Math.cos(m);
        return u[0] = d * a - E * R, u[1] = w * a + S * R, u[2] = E * a + d * R, u[3] = S * a - w * R, u
    }

    function I(O, W, b) {
        const u = b ?? new t(4),
            m = W * .5,
            d = O[0],
            w = O[1],
            E = O[2],
            S = O[3],
            R = Math.sin(m),
            a = Math.cos(m);
        return u[0] = d * a + w * R, u[1] = w * a - d * R, u[2] = E * a + S * R, u[3] = S * a - E * R, u
    }

    function H(O, W, b, u) {
        const m = u ?? new t(4),
            d = O[0],
            w = O[1],
            E = O[2],
            S = O[3];
        let R = W[0],
            a = W[1],
            y = W[2],
            h = W[3],
            p = d * R + w * a + E * y + S * h;
        p < 0 && (p = -p, R = -R, a = -a, y = -y, h = -h);
        let l, g;
        if (1 - p > we) {
            const x = Math.acos(p),
                v = Math.sin(x);
            l = Math.sin((1 - b) * x) / v, g = Math.sin(b * x) / v
        } else l = 1 - b, g = b;
        return m[0] = l * d + g * R, m[1] = l * w + g * a, m[2] = l * E + g * y, m[3] = l * S + g * h, m
    }

    function V(O, W) {
        const b = W ?? new t(4),
            u = O[0],
            m = O[1],
            d = O[2],
            w = O[3],
            E = u * u + m * m + d * d + w * w,
            S = E ? 1 / E : 0;
        return b[0] = -u * S, b[1] = -m * S, b[2] = -d * S, b[3] = w * S, b
    }

    function G(O, W) {
        const b = W ?? new t(4);
        return b[0] = -O[0], b[1] = -O[1], b[2] = -O[2], b[3] = O[3], b
    }

    function j(O, W) {
        const b = W ?? new t(4),
            u = O[0] + O[5] + O[10];
        if (u > 0) {
            const m = Math.sqrt(u + 1);
            b[3] = .5 * m;
            const d = .5 / m;
            b[0] = (O[6] - O[9]) * d, b[1] = (O[8] - O[2]) * d, b[2] = (O[1] - O[4]) * d
        } else {
            let m = 0;
            O[5] > O[0] && (m = 1), O[10] > O[m * 4 + m] && (m = 2);
            const d = (m + 1) % 3,
                w = (m + 2) % 3,
                E = Math.sqrt(O[m * 4 + m] - O[d * 4 + d] - O[w * 4 + w] + 1);
            b[m] = .5 * E;
            const S = .5 / E;
            b[3] = (O[d * 4 + w] - O[w * 4 + d]) * S, b[d] = (O[d * 4 + m] + O[m * 4 + d]) * S, b[w] = (O[w * 4 + m] + O[m * 4 + w]) * S
        }
        return b
    }

    function T(O, W, b, u, m) {
        const d = m ?? new t(4),
            w = O * .5,
            E = W * .5,
            S = b * .5,
            R = Math.sin(w),
            a = Math.cos(w),
            y = Math.sin(E),
            h = Math.cos(E),
            p = Math.sin(S),
            l = Math.cos(S);
        switch (u) {
            case "xyz":
                d[0] = R * h * l + a * y * p, d[1] = a * y * l - R * h * p, d[2] = a * h * p + R * y * l, d[3] = a * h * l - R * y * p;
                break;
            case "xzy":
                d[0] = R * h * l - a * y * p, d[1] = a * y * l - R * h * p, d[2] = a * h * p + R * y * l, d[3] = a * h * l + R * y * p;
                break;
            case "yxz":
                d[0] = R * h * l + a * y * p, d[1] = a * y * l - R * h * p, d[2] = a * h * p - R * y * l, d[3] = a * h * l + R * y * p;
                break;
            case "yzx":
                d[0] = R * h * l + a * y * p, d[1] = a * y * l + R * h * p, d[2] = a * h * p - R * y * l, d[3] = a * h * l - R * y * p;
                break;
            case "zxy":
                d[0] = R * h * l - a * y * p, d[1] = a * y * l + R * h * p, d[2] = a * h * p + R * y * l, d[3] = a * h * l - R * y * p;
                break;
            case "zyx":
                d[0] = R * h * l - a * y * p, d[1] = a * y * l + R * h * p, d[2] = a * h * p - R * y * l, d[3] = a * h * l + R * y * p;
                break;
            default:
                throw new Error(`Unknown rotation order: ${u}`)
        }
        return d
    }

    function Y(O, W) {
        const b = W ?? new t(4);
        return b[0] = O[0], b[1] = O[1], b[2] = O[2], b[3] = O[3], b
    }
    const B = Y;

    function F(O, W, b) {
        const u = b ?? new t(4);
        return u[0] = O[0] + W[0], u[1] = O[1] + W[1], u[2] = O[2] + W[2], u[3] = O[3] + W[3], u
    }

    function D(O, W, b) {
        const u = b ?? new t(4);
        return u[0] = O[0] - W[0], u[1] = O[1] - W[1], u[2] = O[2] - W[2], u[3] = O[3] - W[3], u
    }
    const K = D;

    function P(O, W, b) {
        const u = b ?? new t(4);
        return u[0] = O[0] * W, u[1] = O[1] * W, u[2] = O[2] * W, u[3] = O[3] * W, u
    }
    const U = P;

    function X(O, W, b) {
        const u = b ?? new t(4);
        return u[0] = O[0] / W, u[1] = O[1] / W, u[2] = O[2] / W, u[3] = O[3] / W, u
    }

    function $(O, W) {
        return O[0] * W[0] + O[1] * W[1] + O[2] * W[2] + O[3] * W[3]
    }

    function se(O, W, b, u) {
        const m = u ?? new t(4);
        return m[0] = O[0] + b * (W[0] - O[0]), m[1] = O[1] + b * (W[1] - O[1]), m[2] = O[2] + b * (W[2] - O[2]), m[3] = O[3] + b * (W[3] - O[3]), m
    }

    function te(O) {
        const W = O[0],
            b = O[1],
            u = O[2],
            m = O[3];
        return Math.sqrt(W * W + b * b + u * u + m * m)
    }
    const ie = te;

    function _e(O) {
        const W = O[0],
            b = O[1],
            u = O[2],
            m = O[3];
        return W * W + b * b + u * u + m * m
    }
    const ee = _e;

    function ne(O, W) {
        const b = W ?? new t(4),
            u = O[0],
            m = O[1],
            d = O[2],
            w = O[3],
            E = Math.sqrt(u * u + m * m + d * d + w * w);
        return E > 1e-5 ? (b[0] = u / E, b[1] = m / E, b[2] = d / E, b[3] = w / E) : (b[0] = 0, b[1] = 0, b[2] = 0, b[3] = 1), b
    }

    function ce(O, W) {
        return Math.abs(O[0] - W[0]) < we && Math.abs(O[1] - W[1]) < we && Math.abs(O[2] - W[2]) < we && Math.abs(O[3] - W[3]) < we
    }

    function Ie(O, W) {
        return O[0] === W[0] && O[1] === W[1] && O[2] === W[2] && O[3] === W[3]
    }

    function Fe(O) {
        const W = O ?? new t(4);
        return W[0] = 0, W[1] = 0, W[2] = 0, W[3] = 1, W
    }
    const Oe = e.create(),
        yt = e.create(),
        rt = e.create();

    function Lt(O, W, b) {
        const u = b ?? new t(4),
            m = e.dot(O, W);
        return m < -.999999 ? (e.cross(yt, O, Oe), e.len(Oe) < 1e-6 && e.cross(rt, O, Oe), e.normalize(Oe, Oe), i(Oe, Math.PI, u), u) : m > .999999 ? (u[0] = 0, u[1] = 0, u[2] = 0, u[3] = 1, u) : (e.cross(O, W, Oe), u[0] = Oe[0], u[1] = Oe[1], u[2] = Oe[2], u[3] = 1 + m, ne(u, u))
    }
    const Ke = new t(4),
        Mt = new t(4);

    function ut(O, W, b, u, m, d) {
        const w = d ?? new t(4);
        return H(O, u, m, Ke), H(W, b, m, Mt), H(Ke, Mt, 2 * m * (1 - m), w), w
    }
    return {
        create: n,
        fromValues: s,
        set: r,
        fromAxisAngle: i,
        toAxisAngle: o,
        angle: c,
        multiply: f,
        mul: _,
        rotateX: M,
        rotateY: A,
        rotateZ: I,
        slerp: H,
        inverse: V,
        conjugate: G,
        fromMat: j,
        fromEuler: T,
        copy: Y,
        clone: B,
        add: F,
        subtract: D,
        sub: K,
        mulScalar: P,
        scale: U,
        divScalar: X,
        dot: $,
        lerp: se,
        length: te,
        len: ie,
        lengthSq: _e,
        lenSq: ee,
        normalize: ne,
        equalsApproximately: ce,
        equals: Ie,
        identity: Fe,
        rotationTo: Lt,
        sqlerp: ut
    }
}
const za = new Map;

function tf(t) {
    let e = za.get(t);
    return e || (e = ef(t), za.set(t, e)), e
}

function nf(t) {
    function e(b, u, m, d) {
        const w = new t(4);
        return b !== void 0 && (w[0] = b, u !== void 0 && (w[1] = u, m !== void 0 && (w[2] = m, d !== void 0 && (w[3] = d)))), w
    }
    const n = e;

    function s(b, u, m, d, w) {
        const E = w ?? new t(4);
        return E[0] = b, E[1] = u, E[2] = m, E[3] = d, E
    }

    function r(b, u) {
        const m = u ?? new t(4);
        return m[0] = Math.ceil(b[0]), m[1] = Math.ceil(b[1]), m[2] = Math.ceil(b[2]), m[3] = Math.ceil(b[3]), m
    }

    function i(b, u) {
        const m = u ?? new t(4);
        return m[0] = Math.floor(b[0]), m[1] = Math.floor(b[1]), m[2] = Math.floor(b[2]), m[3] = Math.floor(b[3]), m
    }

    function o(b, u) {
        const m = u ?? new t(4);
        return m[0] = Math.round(b[0]), m[1] = Math.round(b[1]), m[2] = Math.round(b[2]), m[3] = Math.round(b[3]), m
    }

    function c(b, u = 0, m = 1, d) {
        const w = d ?? new t(4);
        return w[0] = Math.min(m, Math.max(u, b[0])), w[1] = Math.min(m, Math.max(u, b[1])), w[2] = Math.min(m, Math.max(u, b[2])), w[3] = Math.min(m, Math.max(u, b[3])), w
    }

    function f(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = b[0] + u[0], d[1] = b[1] + u[1], d[2] = b[2] + u[2], d[3] = b[3] + u[3], d
    }

    function _(b, u, m, d) {
        const w = d ?? new t(4);
        return w[0] = b[0] + u[0] * m, w[1] = b[1] + u[1] * m, w[2] = b[2] + u[2] * m, w[3] = b[3] + u[3] * m, w
    }

    function M(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = b[0] - u[0], d[1] = b[1] - u[1], d[2] = b[2] - u[2], d[3] = b[3] - u[3], d
    }
    const A = M;

    function I(b, u) {
        return Math.abs(b[0] - u[0]) < we && Math.abs(b[1] - u[1]) < we && Math.abs(b[2] - u[2]) < we && Math.abs(b[3] - u[3]) < we
    }

    function H(b, u) {
        return b[0] === u[0] && b[1] === u[1] && b[2] === u[2] && b[3] === u[3]
    }

    function V(b, u, m, d) {
        const w = d ?? new t(4);
        return w[0] = b[0] + m * (u[0] - b[0]), w[1] = b[1] + m * (u[1] - b[1]), w[2] = b[2] + m * (u[2] - b[2]), w[3] = b[3] + m * (u[3] - b[3]), w
    }

    function G(b, u, m, d) {
        const w = d ?? new t(4);
        return w[0] = b[0] + m[0] * (u[0] - b[0]), w[1] = b[1] + m[1] * (u[1] - b[1]), w[2] = b[2] + m[2] * (u[2] - b[2]), w[3] = b[3] + m[3] * (u[3] - b[3]), w
    }

    function j(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = Math.max(b[0], u[0]), d[1] = Math.max(b[1], u[1]), d[2] = Math.max(b[2], u[2]), d[3] = Math.max(b[3], u[3]), d
    }

    function T(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = Math.min(b[0], u[0]), d[1] = Math.min(b[1], u[1]), d[2] = Math.min(b[2], u[2]), d[3] = Math.min(b[3], u[3]), d
    }

    function Y(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = b[0] * u, d[1] = b[1] * u, d[2] = b[2] * u, d[3] = b[3] * u, d
    }
    const B = Y;

    function F(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = b[0] / u, d[1] = b[1] / u, d[2] = b[2] / u, d[3] = b[3] / u, d
    }

    function D(b, u) {
        const m = u ?? new t(4);
        return m[0] = 1 / b[0], m[1] = 1 / b[1], m[2] = 1 / b[2], m[3] = 1 / b[3], m
    }
    const K = D;

    function P(b, u) {
        return b[0] * u[0] + b[1] * u[1] + b[2] * u[2] + b[3] * u[3]
    }

    function U(b) {
        const u = b[0],
            m = b[1],
            d = b[2],
            w = b[3];
        return Math.sqrt(u * u + m * m + d * d + w * w)
    }
    const X = U;

    function $(b) {
        const u = b[0],
            m = b[1],
            d = b[2],
            w = b[3];
        return u * u + m * m + d * d + w * w
    }
    const se = $;

    function te(b, u) {
        const m = b[0] - u[0],
            d = b[1] - u[1],
            w = b[2] - u[2],
            E = b[3] - u[3];
        return Math.sqrt(m * m + d * d + w * w + E * E)
    }
    const ie = te;

    function _e(b, u) {
        const m = b[0] - u[0],
            d = b[1] - u[1],
            w = b[2] - u[2],
            E = b[3] - u[3];
        return m * m + d * d + w * w + E * E
    }
    const ee = _e;

    function ne(b, u) {
        const m = u ?? new t(4),
            d = b[0],
            w = b[1],
            E = b[2],
            S = b[3],
            R = Math.sqrt(d * d + w * w + E * E + S * S);
        return R > 1e-5 ? (m[0] = d / R, m[1] = w / R, m[2] = E / R, m[3] = S / R) : (m[0] = 0, m[1] = 0, m[2] = 0, m[3] = 0), m
    }

    function ce(b, u) {
        const m = u ?? new t(4);
        return m[0] = -b[0], m[1] = -b[1], m[2] = -b[2], m[3] = -b[3], m
    }

    function Ie(b, u) {
        const m = u ?? new t(4);
        return m[0] = b[0], m[1] = b[1], m[2] = b[2], m[3] = b[3], m
    }
    const Fe = Ie;

    function Oe(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = b[0] * u[0], d[1] = b[1] * u[1], d[2] = b[2] * u[2], d[3] = b[3] * u[3], d
    }
    const yt = Oe;

    function rt(b, u, m) {
        const d = m ?? new t(4);
        return d[0] = b[0] / u[0], d[1] = b[1] / u[1], d[2] = b[2] / u[2], d[3] = b[3] / u[3], d
    }
    const Lt = rt;

    function Ke(b) {
        const u = b ?? new t(4);
        return u[0] = 0, u[1] = 0, u[2] = 0, u[3] = 0, u
    }

    function Mt(b, u, m) {
        const d = m ?? new t(4),
            w = b[0],
            E = b[1],
            S = b[2],
            R = b[3];
        return d[0] = u[0] * w + u[4] * E + u[8] * S + u[12] * R, d[1] = u[1] * w + u[5] * E + u[9] * S + u[13] * R, d[2] = u[2] * w + u[6] * E + u[10] * S + u[14] * R, d[3] = u[3] * w + u[7] * E + u[11] * S + u[15] * R, d
    }

    function ut(b, u, m) {
        const d = m ?? new t(4);
        return ne(b, d), Y(d, u, d)
    }

    function O(b, u, m) {
        const d = m ?? new t(4);
        return U(b) > u ? ut(b, u, d) : Ie(b, d)
    }

    function W(b, u, m) {
        const d = m ?? new t(4);
        return V(b, u, .5, d)
    }
    return {
        create: e,
        fromValues: n,
        set: s,
        ceil: r,
        floor: i,
        round: o,
        clamp: c,
        add: f,
        addScaled: _,
        subtract: M,
        sub: A,
        equalsApproximately: I,
        equals: H,
        lerp: V,
        lerpV: G,
        max: j,
        min: T,
        mulScalar: Y,
        scale: B,
        divScalar: F,
        inverse: D,
        invert: K,
        dot: P,
        length: U,
        len: X,
        lengthSq: $,
        lenSq: se,
        distance: te,
        dist: ie,
        distanceSq: _e,
        distSq: ee,
        normalize: ne,
        negate: ce,
        copy: Ie,
        clone: Fe,
        multiply: Oe,
        mul: yt,
        divide: rt,
        div: Lt,
        zero: Ke,
        transformMat4: Mt,
        setLength: ut,
        truncate: O,
        midpoint: W
    }
}
const ja = new Map;

function sf(t) {
    let e = ja.get(t);
    return e || (e = nf(t), ja.set(t, e)), e
}

function Mo(t, e, n, s, r, i) {
    return {
        mat3: J1(t),
        mat4: Q1(e),
        quat: tf(n),
        vec2: Ru(s),
        vec3: Qr(r),
        vec4: sf(i)
    }
}
const {
    mat4: Pt,
    vec3: ve
} = Mo(Float32Array, Float32Array, Float32Array, Float32Array, Float32Array, Float32Array);
Mo(Float64Array, Float64Array, Float64Array, Float64Array, Float64Array, Float64Array);
Mo(Y1, Array, Array, Array, Array, Array);

function rf(t) {
    if (!(typeof window > "u")) {
        var e = document.createElement("style");
        return e.setAttribute("type", "text/css"), e.innerHTML = t, document.head.appendChild(e), t
    }
}

function ms(t, e) {
    var n = t.__state.conversionName.toString(),
        s = Math.round(t.r),
        r = Math.round(t.g),
        i = Math.round(t.b),
        o = t.a,
        c = Math.round(t.h),
        f = t.s.toFixed(1),
        _ = t.v.toFixed(1);
    if (e || n === "THREE_CHAR_HEX" || n === "SIX_CHAR_HEX") {
        for (var M = t.hex.toString(16); M.length < 6;) M = "0" + M;
        return "#" + M
    } else {
        if (n === "CSS_RGB") return "rgb(" + s + "," + r + "," + i + ")";
        if (n === "CSS_RGBA") return "rgba(" + s + "," + r + "," + i + "," + o + ")";
        if (n === "HEX") return "0x" + t.hex.toString(16);
        if (n === "RGB_ARRAY") return "[" + s + "," + r + "," + i + "]";
        if (n === "RGBA_ARRAY") return "[" + s + "," + r + "," + i + "," + o + "]";
        if (n === "RGB_OBJ") return "{r:" + s + ",g:" + r + ",b:" + i + "}";
        if (n === "RGBA_OBJ") return "{r:" + s + ",g:" + r + ",b:" + i + ",a:" + o + "}";
        if (n === "HSV_OBJ") return "{h:" + c + ",s:" + f + ",v:" + _ + "}";
        if (n === "HSVA_OBJ") return "{h:" + c + ",s:" + f + ",v:" + _ + ",a:" + o + "}"
    }
    return "unknown format"
}
var Ha = Array.prototype.forEach,
    zs = Array.prototype.slice,
    q = {
        BREAK: {},
        extend: function (e) {
            return this.each(zs.call(arguments, 1), function (n) {
                var s = this.isObject(n) ? Object.keys(n) : [];
                s.forEach((function (r) {
                    this.isUndefined(n[r]) || (e[r] = n[r])
                }).bind(this))
            }, this), e
        },
        defaults: function (e) {
            return this.each(zs.call(arguments, 1), function (n) {
                var s = this.isObject(n) ? Object.keys(n) : [];
                s.forEach((function (r) {
                    this.isUndefined(e[r]) && (e[r] = n[r])
                }).bind(this))
            }, this), e
        },
        compose: function () {
            var e = zs.call(arguments);
            return function () {
                for (var n = zs.call(arguments), s = e.length - 1; s >= 0; s--) n = [e[s].apply(this, n)];
                return n[0]
            }
        },
        each: function (e, n, s) {
            if (e) {
                if (Ha && e.forEach && e.forEach === Ha) e.forEach(n, s);
                else if (e.length === e.length + 0) {
                    var r = void 0,
                        i = void 0;
                    for (r = 0, i = e.length; r < i; r++)
                        if (r in e && n.call(s, e[r], r) === this.BREAK) return
                } else
                    for (var o in e)
                        if (n.call(s, e[o], o) === this.BREAK) return
            }
        },
        defer: function (e) {
            setTimeout(e, 0)
        },
        debounce: function (e, n, s) {
            var r = void 0;
            return function () {
                var i = this,
                    o = arguments;

                function c() {
                    r = null, s || e.apply(i, o)
                }
                var f = s || !r;
                clearTimeout(r), r = setTimeout(c, n), f && e.apply(i, o)
            }
        },
        toArray: function (e) {
            return e.toArray ? e.toArray() : zs.call(e)
        },
        isUndefined: function (e) {
            return e === void 0
        },
        isNull: function (e) {
            return e === null
        },
        isNaN: function (t) {
            function e(n) {
                return t.apply(this, arguments)
            }
            return e.toString = function () {
                return t.toString()
            }, e
        }(function (t) {
            return isNaN(t)
        }),
        isArray: Array.isArray || function (t) {
            return t.constructor === Array
        },
        isObject: function (e) {
            return e === Object(e)
        },
        isNumber: function (e) {
            return e === e + 0
        },
        isString: function (e) {
            return e === e + ""
        },
        isBoolean: function (e) {
            return e === !1 || e === !0
        },
        isFunction: function (e) {
            return e instanceof Function
        }
    },
    of = [{
        litmus: q.isString,
        conversions: {
            THREE_CHAR_HEX: {
                read: function (e) {
                    var n = e.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
                    return n === null ? !1 : {
                        space: "HEX",
                        hex: parseInt("0x" + n[1].toString() + n[1].toString() + n[2].toString() + n[2].toString() + n[3].toString() + n[3].toString(), 0)
                    }
                },
                write: ms
            },
            SIX_CHAR_HEX: {
                read: function (e) {
                    var n = e.match(/^#([A-F0-9]{6})$/i);
                    return n === null ? !1 : {
                        space: "HEX",
                        hex: parseInt("0x" + n[1].toString(), 0)
                    }
                },
                write: ms
            },
            CSS_RGB: {
                read: function (e) {
                    var n = e.match(/^rgb\(\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*\)/);
                    return n === null ? !1 : {
                        space: "RGB",
                        r: parseFloat(n[1]),
                        g: parseFloat(n[2]),
                        b: parseFloat(n[3])
                    }
                },
                write: ms
            },
            CSS_RGBA: {
                read: function (e) {
                    var n = e.match(/^rgba\(\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*\)/);
                    return n === null ? !1 : {
                        space: "RGB",
                        r: parseFloat(n[1]),
                        g: parseFloat(n[2]),
                        b: parseFloat(n[3]),
                        a: parseFloat(n[4])
                    }
                },
                write: ms
            }
        }
    }, {
        litmus: q.isNumber,
        conversions: {
            HEX: {
                read: function (e) {
                    return {
                        space: "HEX",
                        hex: e,
                        conversionName: "HEX"
                    }
                },
                write: function (e) {
                    return e.hex
                }
            }
        }
    }, {
        litmus: q.isArray,
        conversions: {
            RGB_ARRAY: {
                read: function (e) {
                    return e.length !== 3 ? !1 : {
                        space: "RGB",
                        r: e[0],
                        g: e[1],
                        b: e[2]
                    }
                },
                write: function (e) {
                    return [e.r, e.g, e.b]
                }
            },
            RGBA_ARRAY: {
                read: function (e) {
                    return e.length !== 4 ? !1 : {
                        space: "RGB",
                        r: e[0],
                        g: e[1],
                        b: e[2],
                        a: e[3]
                    }
                },
                write: function (e) {
                    return [e.r, e.g, e.b, e.a]
                }
            }
        }
    }, {
        litmus: q.isObject,
        conversions: {
            RGBA_OBJ: {
                read: function (e) {
                    return q.isNumber(e.r) && q.isNumber(e.g) && q.isNumber(e.b) && q.isNumber(e.a) ? {
                        space: "RGB",
                        r: e.r,
                        g: e.g,
                        b: e.b,
                        a: e.a
                    } : !1
                },
                write: function (e) {
                    return {
                        r: e.r,
                        g: e.g,
                        b: e.b,
                        a: e.a
                    }
                }
            },
            RGB_OBJ: {
                read: function (e) {
                    return q.isNumber(e.r) && q.isNumber(e.g) && q.isNumber(e.b) ? {
                        space: "RGB",
                        r: e.r,
                        g: e.g,
                        b: e.b
                    } : !1
                },
                write: function (e) {
                    return {
                        r: e.r,
                        g: e.g,
                        b: e.b
                    }
                }
            },
            HSVA_OBJ: {
                read: function (e) {
                    return q.isNumber(e.h) && q.isNumber(e.s) && q.isNumber(e.v) && q.isNumber(e.a) ? {
                        space: "HSV",
                        h: e.h,
                        s: e.s,
                        v: e.v,
                        a: e.a
                    } : !1
                },
                write: function (e) {
                    return {
                        h: e.h,
                        s: e.s,
                        v: e.v,
                        a: e.a
                    }
                }
            },
            HSV_OBJ: {
                read: function (e) {
                    return q.isNumber(e.h) && q.isNumber(e.s) && q.isNumber(e.v) ? {
                        space: "HSV",
                        h: e.h,
                        s: e.s,
                        v: e.v
                    } : !1
                },
                write: function (e) {
                    return {
                        h: e.h,
                        s: e.s,
                        v: e.v
                    }
                }
            }
        }
    }],
    js = void 0,
    br = void 0,
    $i = function () {
        br = !1;
        var e = arguments.length > 1 ? q.toArray(arguments) : arguments[0];
        return q.each(of, function (n) {
            if (n.litmus(e)) return q.each(n.conversions, function (s, r) {
                if (js = s.read(e), br === !1 && js !== !1) return br = js, js.conversionName = r, js.conversion = s, q.BREAK
            }), q.BREAK
        }), br
    },
    qa = void 0,
    Gr = {
        hsv_to_rgb: function (e, n, s) {
            var r = Math.floor(e / 60) % 6,
                i = e / 60 - Math.floor(e / 60),
                o = s * (1 - n),
                c = s * (1 - i * n),
                f = s * (1 - (1 - i) * n),
                _ = [
                    [s, f, o],
                    [c, s, o],
                    [o, s, f],
                    [o, c, s],
                    [f, o, s],
                    [s, o, c]
                ][r];
            return {
                r: _[0] * 255,
                g: _[1] * 255,
                b: _[2] * 255
            }
        },
        rgb_to_hsv: function (e, n, s) {
            var r = Math.min(e, n, s),
                i = Math.max(e, n, s),
                o = i - r,
                c = void 0,
                f = void 0;
            if (i !== 0) f = o / i;
            else return {
                h: NaN,
                s: 0,
                v: 0
            };
            return e === i ? c = (n - s) / o : n === i ? c = 2 + (s - e) / o : c = 4 + (e - n) / o, c /= 6, c < 0 && (c += 1), {
                h: c * 360,
                s: f,
                v: i / 255
            }
        },
        rgb_to_hex: function (e, n, s) {
            var r = this.hex_with_component(0, 2, e);
            return r = this.hex_with_component(r, 1, n), r = this.hex_with_component(r, 0, s), r
        },
        component_from_hex: function (e, n) {
            return e >> n * 8 & 255
        },
        hex_with_component: function (e, n, s) {
            return s << (qa = n * 8) | e & ~(255 << qa)
        }
    },
    af = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function (t) {
        return typeof t
    } : function (t) {
        return t && typeof Symbol == "function" && t.constructor === Symbol && t !== Symbol.prototype ? "symbol" : typeof t
    },
    rn = function (t, e) {
        if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function")
    },
    on = function () {
        function t(e, n) {
            for (var s = 0; s < n.length; s++) {
                var r = n[s];
                r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), Object.defineProperty(e, r.key, r)
            }
        }
        return function (e, n, s) {
            return n && t(e.prototype, n), s && t(e, s), e
        }
    }(),
    Gn = function t(e, n, s) {
        e === null && (e = Function.prototype);
        var r = Object.getOwnPropertyDescriptor(e, n);
        if (r === void 0) {
            var i = Object.getPrototypeOf(e);
            return i === null ? void 0 : t(i, n, s)
        } else {
            if ("value" in r) return r.value;
            var o = r.get;
            return o === void 0 ? void 0 : o.call(s)
        }
    },
    Hn = function (t, e) {
        if (typeof e != "function" && e !== null) throw new TypeError("Super expression must either be null or a function, not " + typeof e);
        t.prototype = Object.create(e && e.prototype, {
            constructor: {
                value: t,
                enumerable: !1,
                writable: !0,
                configurable: !0
            }
        }), e && (Object.setPrototypeOf ? Object.setPrototypeOf(t, e) : t.__proto__ = e)
    },
    qn = function (t, e) {
        if (!t) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        return e && (typeof e == "object" || typeof e == "function") ? e : t
    },
    at = function () {
        function t() {
            if (rn(this, t), this.__state = $i.apply(this, arguments), this.__state === !1) throw new Error("Failed to interpret color arguments");
            this.__state.a = this.__state.a || 1
        }
        return on(t, [{
            key: "toString",
            value: function () {
                return ms(this)
            }
        }, {
            key: "toHexString",
            value: function () {
                return ms(this, !0)
            }
        }, {
            key: "toOriginal",
            value: function () {
                return this.__state.conversion.write(this)
            }
        }]), t
    }();

function Ro(t, e, n) {
    Object.defineProperty(t, e, {
        get: function () {
            return this.__state.space === "RGB" ? this.__state[e] : (at.recalculateRGB(this, e, n), this.__state[e])
        },
        set: function (r) {
            this.__state.space !== "RGB" && (at.recalculateRGB(this, e, n), this.__state.space = "RGB"), this.__state[e] = r
        }
    })
}

function Po(t, e) {
    Object.defineProperty(t, e, {
        get: function () {
            return this.__state.space === "HSV" ? this.__state[e] : (at.recalculateHSV(this), this.__state[e])
        },
        set: function (s) {
            this.__state.space !== "HSV" && (at.recalculateHSV(this), this.__state.space = "HSV"), this.__state[e] = s
        }
    })
}
at.recalculateRGB = function (t, e, n) {
    if (t.__state.space === "HEX") t.__state[e] = Gr.component_from_hex(t.__state.hex, n);
    else if (t.__state.space === "HSV") q.extend(t.__state, Gr.hsv_to_rgb(t.__state.h, t.__state.s, t.__state.v));
    else throw new Error("Corrupted color state")
};
at.recalculateHSV = function (t) {
    var e = Gr.rgb_to_hsv(t.r, t.g, t.b);
    q.extend(t.__state, {
        s: e.s,
        v: e.v
    }), q.isNaN(e.h) ? q.isUndefined(t.__state.h) && (t.__state.h = 0) : t.__state.h = e.h
};
at.COMPONENTS = ["r", "g", "b", "h", "s", "v", "hex", "a"];
Ro(at.prototype, "r", 2);
Ro(at.prototype, "g", 1);
Ro(at.prototype, "b", 0);
Po(at.prototype, "h");
Po(at.prototype, "s");
Po(at.prototype, "v");
Object.defineProperty(at.prototype, "a", {
    get: function () {
        return this.__state.a
    },
    set: function (e) {
        this.__state.a = e
    }
});
Object.defineProperty(at.prototype, "hex", {
    get: function () {
        return this.__state.space !== "HEX" && (this.__state.hex = Gr.rgb_to_hex(this.r, this.g, this.b), this.__state.space = "HEX"), this.__state.hex
    },
    set: function (e) {
        this.__state.space = "HEX", this.__state.hex = e
    }
});
var us = function () {
    function t(e, n) {
        rn(this, t), this.initialValue = e[n], this.domElement = document.createElement("div"), this.object = e, this.property = n, this.__onChange = void 0, this.__onFinishChange = void 0
    }
    return on(t, [{
        key: "onChange",
        value: function (n) {
            return this.__onChange = n, this
        }
    }, {
        key: "onFinishChange",
        value: function (n) {
            return this.__onFinishChange = n, this
        }
    }, {
        key: "setValue",
        value: function (n) {
            return this.object[this.property] = n, this.__onChange && this.__onChange.call(this, n), this.updateDisplay(), this
        }
    }, {
        key: "getValue",
        value: function () {
            return this.object[this.property]
        }
    }, {
        key: "updateDisplay",
        value: function () {
            return this
        }
    }, {
        key: "isModified",
        value: function () {
            return this.initialValue !== this.getValue()
        }
    }]), t
}(),
    cf = {
        HTMLEvents: ["change"],
        MouseEvents: ["click", "mousemove", "mousedown", "mouseup", "mouseover"],
        KeyboardEvents: ["keydown"]
    },
    Pu = {};
q.each(cf, function (t, e) {
    q.each(t, function (n) {
        Pu[n] = e
    })
});
var uf = /(\d+(\.\d+)?)px/;

function fn(t) {
    if (t === "0" || q.isUndefined(t)) return 0;
    var e = t.match(uf);
    return q.isNull(e) ? 0 : parseFloat(e[1])
}
var k = {
    makeSelectable: function (e, n) {
        e === void 0 || e.style === void 0 || (e.onselectstart = n ? function () {
            return !1
        } : function () { }, e.style.MozUserSelect = n ? "auto" : "none", e.style.KhtmlUserSelect = n ? "auto" : "none", e.unselectable = n ? "on" : "off")
    },
    makeFullscreen: function (e, n, s) {
        var r = s,
            i = n;
        q.isUndefined(i) && (i = !0), q.isUndefined(r) && (r = !0), e.style.position = "absolute", i && (e.style.left = 0, e.style.right = 0), r && (e.style.top = 0, e.style.bottom = 0)
    },
    fakeEvent: function (e, n, s, r) {
        var i = s || {},
            o = Pu[n];
        if (!o) throw new Error("Event type " + n + " not supported.");
        var c = document.createEvent(o);
        switch (o) {
            case "MouseEvents": {
                var f = i.x || i.clientX || 0,
                    _ = i.y || i.clientY || 0;
                c.initMouseEvent(n, i.bubbles || !1, i.cancelable || !0, window, i.clickCount || 1, 0, 0, f, _, !1, !1, !1, !1, 0, null);
                break
            }
            case "KeyboardEvents": {
                var M = c.initKeyboardEvent || c.initKeyEvent;
                q.defaults(i, {
                    cancelable: !0,
                    ctrlKey: !1,
                    altKey: !1,
                    shiftKey: !1,
                    metaKey: !1,
                    keyCode: void 0,
                    charCode: void 0
                }), M(n, i.bubbles || !1, i.cancelable, window, i.ctrlKey, i.altKey, i.shiftKey, i.metaKey, i.keyCode, i.charCode);
                break
            }
            default: {
                c.initEvent(n, i.bubbles || !1, i.cancelable || !0);
                break
            }
        }
        q.defaults(c, r), e.dispatchEvent(c)
    },
    bind: function (e, n, s, r) {
        var i = r || !1;
        return e.addEventListener ? e.addEventListener(n, s, i) : e.attachEvent && e.attachEvent("on" + n, s), k
    },
    unbind: function (e, n, s, r) {
        var i = r || !1;
        return e.removeEventListener ? e.removeEventListener(n, s, i) : e.detachEvent && e.detachEvent("on" + n, s), k
    },
    addClass: function (e, n) {
        if (e.className === void 0) e.className = n;
        else if (e.className !== n) {
            var s = e.className.split(/ +/);
            s.indexOf(n) === -1 && (s.push(n), e.className = s.join(" ").replace(/^\s+/, "").replace(/\s+$/, ""))
        }
        return k
    },
    removeClass: function (e, n) {
        if (n)
            if (e.className === n) e.removeAttribute("class");
            else {
                var s = e.className.split(/ +/),
                    r = s.indexOf(n);
                r !== -1 && (s.splice(r, 1), e.className = s.join(" "))
            }
        else e.className = void 0;
        return k
    },
    hasClass: function (e, n) {
        return new RegExp("(?:^|\\s+)" + n + "(?:\\s+|$)").test(e.className) || !1
    },
    getWidth: function (e) {
        var n = getComputedStyle(e);
        return fn(n["border-left-width"]) + fn(n["border-right-width"]) + fn(n["padding-left"]) + fn(n["padding-right"]) + fn(n.width)
    },
    getHeight: function (e) {
        var n = getComputedStyle(e);
        return fn(n["border-top-width"]) + fn(n["border-bottom-width"]) + fn(n["padding-top"]) + fn(n["padding-bottom"]) + fn(n.height)
    },
    getOffset: function (e) {
        var n = e,
            s = {
                left: 0,
                top: 0
            };
        if (n.offsetParent)
            do s.left += n.offsetLeft, s.top += n.offsetTop, n = n.offsetParent; while (n);
        return s
    },
    isActive: function (e) {
        return e === document.activeElement && (e.type || e.href)
    }
},
    Bu = function (t) {
        Hn(e, t);

        function e(n, s) {
            rn(this, e);
            var r = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s)),
                i = r;
            r.__prev = r.getValue(), r.__checkbox = document.createElement("input"), r.__checkbox.setAttribute("type", "checkbox");

            function o() {
                console.log(['i, i.setValue, i.__prev', i, i.setValue, i.__prev]);

                i.setValue(!i.__prev)
            }
            return k.bind(r.__checkbox, "change", o, !1), r.domElement.appendChild(r.__checkbox), r.updateDisplay(), r
        }
        return on(e, [{
            key: "setValue",
            value: function (s) {
                console.log(['s',s]);
                var r = Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "setValue", this).call(this, s);
                console.log(['r, this.__onFinishChange', r, this.__onFinishChange]);
                return this.__onFinishChange && this.__onFinishChange.call(this, this.getValue()), this.__prev = this.getValue(), r
            }
        }, {
            key: "updateDisplay",
            value: function () {
                return this.getValue() === !0 ? (this.__checkbox.setAttribute("checked", "checked"), this.__checkbox.checked = !0, this.__prev = !0) : (this.__checkbox.checked = !1, this.__prev = !1), Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "updateDisplay", this).call(this)
            }
        }]), e
    }(us),
    lf = function (t) {
        Hn(e, t);

        function e(n, s, r) {
            rn(this, e);
            var i = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s)),
                o = r,
                c = i;
            if (i.__select = document.createElement("select"), q.isArray(o)) {
                var f = {};
                q.each(o, function (_) {
                    f[_] = _
                }), o = f
            }
            return q.each(o, function (_, M) {
                var A = document.createElement("option");
                A.innerHTML = M, A.setAttribute("value", _), c.__select.appendChild(A)
            }), i.updateDisplay(), k.bind(i.__select, "change", function () {
                var _ = this.options[this.selectedIndex].value;
                c.setValue(_)
            }), i.domElement.appendChild(i.__select), i
        }
        return on(e, [{
            key: "setValue",
            value: function (s) {
                var r = Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "setValue", this).call(this, s);
                return this.__onFinishChange && this.__onFinishChange.call(this, this.getValue()), r
            }
        }, {
            key: "updateDisplay",
            value: function () {
                return k.isActive(this.__select) ? this : (this.__select.value = this.getValue(), Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "updateDisplay", this).call(this))
            }
        }]), e
    }(us),
    ff = function (t) {
        Hn(e, t);

        function e(n, s) {
            rn(this, e);
            var r = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s)),
                i = r;

            function o() {
                i.setValue(i.__input.value)
            }

            function c() {
                i.__onFinishChange && i.__onFinishChange.call(i, i.getValue())
            }
            return r.__input = document.createElement("input"), r.__input.setAttribute("type", "text"), k.bind(r.__input, "keyup", o), k.bind(r.__input, "change", o), k.bind(r.__input, "blur", c), k.bind(r.__input, "keydown", function (f) {
                f.keyCode === 13 && this.blur()
            }), r.updateDisplay(), r.domElement.appendChild(r.__input), r
        }
        return on(e, [{
            key: "updateDisplay",
            value: function () {
                return k.isActive(this.__input) || (this.__input.value = this.getValue()), Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "updateDisplay", this).call(this)
            }
        }]), e
    }(us);

function Wa(t) {
    var e = t.toString();
    return e.indexOf(".") > -1 ? e.length - e.indexOf(".") - 1 : 0
}
var Iu = function (t) {
    Hn(e, t);

    function e(n, s, r) {
        rn(this, e);
        var i = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s)),
            o = r || {};
        return i.__min = o.min, i.__max = o.max, i.__step = o.step, q.isUndefined(i.__step) ? i.initialValue === 0 ? i.__impliedStep = 1 : i.__impliedStep = Math.pow(10, Math.floor(Math.log(Math.abs(i.initialValue)) / Math.LN10)) / 10 : i.__impliedStep = i.__step, i.__precision = Wa(i.__impliedStep), i
    }
    return on(e, [{
        key: "setValue",
        value: function (s) {
            var r = s;
            return this.__min !== void 0 && r < this.__min ? r = this.__min : this.__max !== void 0 && r > this.__max && (r = this.__max), this.__step !== void 0 && r % this.__step !== 0 && (r = Math.round(r / this.__step) * this.__step), Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "setValue", this).call(this, r)
        }
    }, {
        key: "min",
        value: function (s) {
            return this.__min = s, this
        }
    }, {
        key: "max",
        value: function (s) {
            return this.__max = s, this
        }
    }, {
        key: "step",
        value: function (s) {
            return this.__step = s, this.__impliedStep = s, this.__precision = Wa(s), this
        }
    }]), e
}(us);

function hf(t, e) {
    var n = Math.pow(10, e);
    return Math.round(t * n) / n
}
var Vr = function (t) {
    Hn(e, t);

    function e(n, s, r) {
        rn(this, e);
        var i = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s, r));
        i.__truncationSuspended = !1;
        var o = i,
            c = void 0;

        function f() {
            var V = parseFloat(o.__input.value);
            q.isNaN(V) || o.setValue(V)
        }

        function _() {
            o.__onFinishChange && o.__onFinishChange.call(o, o.getValue())
        }

        function M() {
            _()
        }

        function A(V) {
            var G = c - V.clientY;
            o.setValue(o.getValue() + G * o.__impliedStep), c = V.clientY
        }

        function I() {
            k.unbind(window, "mousemove", A), k.unbind(window, "mouseup", I), _()
        }

        function H(V) {
            k.bind(window, "mousemove", A), k.bind(window, "mouseup", I), c = V.clientY
        }
        return i.__input = document.createElement("input"), i.__input.setAttribute("type", "text"), k.bind(i.__input, "change", f), k.bind(i.__input, "blur", M), k.bind(i.__input, "mousedown", H), k.bind(i.__input, "keydown", function (V) {
            V.keyCode === 13 && (o.__truncationSuspended = !0, this.blur(), o.__truncationSuspended = !1, _())
        }), i.updateDisplay(), i.domElement.appendChild(i.__input), i
    }
    return on(e, [{
        key: "updateDisplay",
        value: function () {
            return this.__input.value = this.__truncationSuspended ? this.getValue() : hf(this.getValue(), this.__precision), Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "updateDisplay", this).call(this)
        }
    }]), e
}(Iu);

function Ya(t, e, n, s, r) {
    return s + (r - s) * ((t - e) / (n - e))
}
var Xi = function (t) {
    Hn(e, t);

    function e(n, s, r, i, o) {
        rn(this, e);
        var c = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s, {
            min: r,
            max: i,
            step: o
        })),
            f = c;
        c.__background = document.createElement("div"), c.__foreground = document.createElement("div"), k.bind(c.__background, "mousedown", _), k.bind(c.__background, "touchstart", I), k.addClass(c.__background, "slider"), k.addClass(c.__foreground, "slider-fg");

        function _(G) {
            document.activeElement.blur(), k.bind(window, "mousemove", M), k.bind(window, "mouseup", A), M(G)
        }

        function M(G) {
            G.preventDefault();
            var j = f.__background.getBoundingClientRect();
            return f.setValue(Ya(G.clientX, j.left, j.right, f.__min, f.__max)), !1
        }

        function A() {
            k.unbind(window, "mousemove", M), k.unbind(window, "mouseup", A), f.__onFinishChange && f.__onFinishChange.call(f, f.getValue())
        }

        function I(G) {
            G.touches.length === 1 && (k.bind(window, "touchmove", H), k.bind(window, "touchend", V), H(G))
        }

        function H(G) {
            var j = G.touches[0].clientX,
                T = f.__background.getBoundingClientRect();
            f.setValue(Ya(j, T.left, T.right, f.__min, f.__max))
        }

        function V() {
            k.unbind(window, "touchmove", H), k.unbind(window, "touchend", V), f.__onFinishChange && f.__onFinishChange.call(f, f.getValue())
        }
        return c.updateDisplay(), c.__background.appendChild(c.__foreground), c.domElement.appendChild(c.__background), c
    }
    return on(e, [{
        key: "updateDisplay",
        value: function () {
            var s = (this.getValue() - this.__min) / (this.__max - this.__min);
            return this.__foreground.style.width = s * 100 + "%", Gn(e.prototype.__proto__ || Object.getPrototypeOf(e.prototype), "updateDisplay", this).call(this)
        }
    }]), e
}(Iu),
    Ou = function (t) {
        Hn(e, t);

        function e(n, s, r) {
            rn(this, e);
            var i = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s)),
                o = i;
            return i.__button = document.createElement("div"), i.__button.innerHTML = r === void 0 ? "Fire" : r, k.bind(i.__button, "click", function (c) {
                return c.preventDefault(), o.fire(), !1
            }), k.addClass(i.__button, "button"), i.domElement.appendChild(i.__button), i
        }
        return on(e, [{
            key: "fire",
            value: function () {
                this.__onChange && this.__onChange.call(this), this.getValue().call(this.object), this.__onFinishChange && this.__onFinishChange.call(this, this.getValue())
            }
        }]), e
    }(us),
    Ki = function (t) {
        Hn(e, t);

        function e(n, s) {
            rn(this, e);
            var r = qn(this, (e.__proto__ || Object.getPrototypeOf(e)).call(this, n, s));
            r.__color = new at(r.getValue()), r.__temp = new at(0);
            var i = r;
            r.domElement = document.createElement("div"), k.makeSelectable(r.domElement, !1), r.__selector = document.createElement("div"), r.__selector.className = "selector", r.__saturation_field = document.createElement("div"), r.__saturation_field.className = "saturation-field", r.__field_knob = document.createElement("div"), r.__field_knob.className = "field-knob", r.__field_knob_border = "2px solid ", r.__hue_knob = document.createElement("div"), r.__hue_knob.className = "hue-knob", r.__hue_field = document.createElement("div"), r.__hue_field.className = "hue-field", r.__input = document.createElement("input"), r.__input.type = "text", r.__input_textShadow = "0 1px 1px ", k.bind(r.__input, "keydown", function (G) {
                G.keyCode === 13 && A.call(this)
            }), k.bind(r.__input, "blur", A), k.bind(r.__selector, "mousedown", function () {
                k.addClass(this, "drag").bind(window, "mouseup", function () {
                    k.removeClass(i.__selector, "drag")
                })
            }), k.bind(r.__selector, "touchstart", function () {
                k.addClass(this, "drag").bind(window, "touchend", function () {
                    k.removeClass(i.__selector, "drag")
                })
            });
            var o = document.createElement("div");
            q.extend(r.__selector.style, {
                width: "122px",
                height: "102px",
                padding: "3px",
                backgroundColor: "#222",
                boxShadow: "0px 1px 3px rgba(0,0,0,0.3)"
            }), q.extend(r.__field_knob.style, {
                position: "absolute",
                width: "12px",
                height: "12px",
                border: r.__field_knob_border + (r.__color.v < .5 ? "#fff" : "#000"),
                boxShadow: "0px 1px 3px rgba(0,0,0,0.5)",
                borderRadius: "12px",
                zIndex: 1
            }), q.extend(r.__hue_knob.style, {
                position: "absolute",
                width: "15px",
                height: "2px",
                borderRight: "4px solid #fff",
                zIndex: 1
            }), q.extend(r.__saturation_field.style, {
                width: "100px",
                height: "100px",
                border: "1px solid #555",
                marginRight: "3px",
                display: "inline-block",
                cursor: "pointer"
            }), q.extend(o.style, {
                width: "100%",
                height: "100%",
                background: "none"
            }), $a(o, "top", "rgba(0,0,0,0)", "#000"), q.extend(r.__hue_field.style, {
                width: "15px",
                height: "100px",
                border: "1px solid #555",
                cursor: "ns-resize",
                position: "absolute",
                top: "3px",
                right: "3px"
            }), pf(r.__hue_field), q.extend(r.__input.style, {
                outline: "none",
                textAlign: "center",
                color: "#fff",
                border: 0,
                fontWeight: "bold",
                textShadow: r.__input_textShadow + "rgba(0,0,0,0.7)"
            }), k.bind(r.__saturation_field, "mousedown", c), k.bind(r.__saturation_field, "touchstart", c), k.bind(r.__field_knob, "mousedown", c), k.bind(r.__field_knob, "touchstart", c), k.bind(r.__hue_field, "mousedown", f), k.bind(r.__hue_field, "touchstart", f);

            function c(G) {
                H(G), k.bind(window, "mousemove", H), k.bind(window, "touchmove", H), k.bind(window, "mouseup", _), k.bind(window, "touchend", _)
            }

            function f(G) {
                V(G), k.bind(window, "mousemove", V), k.bind(window, "touchmove", V), k.bind(window, "mouseup", M), k.bind(window, "touchend", M)
            }

            function _() {
                k.unbind(window, "mousemove", H), k.unbind(window, "touchmove", H), k.unbind(window, "mouseup", _), k.unbind(window, "touchend", _), I()
            }

            function M() {
                k.unbind(window, "mousemove", V), k.unbind(window, "touchmove", V), k.unbind(window, "mouseup", M), k.unbind(window, "touchend", M), I()
            }

            function A() {
                var G = $i(this.value);
                G !== !1 ? (i.__color.__state = G, i.setValue(i.__color.toOriginal())) : this.value = i.__color.toString()
            }

            function I() {
                i.__onFinishChange && i.__onFinishChange.call(i, i.__color.toOriginal())
            }
            r.__saturation_field.appendChild(o), r.__selector.appendChild(r.__field_knob), r.__selector.appendChild(r.__saturation_field), r.__selector.appendChild(r.__hue_field), r.__hue_field.appendChild(r.__hue_knob), r.domElement.appendChild(r.__input), r.domElement.appendChild(r.__selector), r.updateDisplay();

            function H(G) {
                G.type.indexOf("touch") === -1 && G.preventDefault();
                var j = i.__saturation_field.getBoundingClientRect(),
                    T = G.touches && G.touches[0] || G,
                    Y = T.clientX,
                    B = T.clientY,
                    F = (Y - j.left) / (j.right - j.left),
                    D = 1 - (B - j.top) / (j.bottom - j.top);
                return D > 1 ? D = 1 : D < 0 && (D = 0), F > 1 ? F = 1 : F < 0 && (F = 0), i.__color.v = D, i.__color.s = F, i.setValue(i.__color.toOriginal()), !1
            }

            function V(G) {
                G.type.indexOf("touch") === -1 && G.preventDefault();
                var j = i.__hue_field.getBoundingClientRect(),
                    T = G.touches && G.touches[0] || G,
                    Y = T.clientY,
                    B = 1 - (Y - j.top) / (j.bottom - j.top);
                return B > 1 ? B = 1 : B < 0 && (B = 0), i.__color.h = B * 360, i.setValue(i.__color.toOriginal()), !1
            }
            return r
        }
        return on(e, [{
            key: "updateDisplay",
            value: function () {
                var s = $i(this.getValue());
                if (s !== !1) {
                    var r = !1;
                    q.each(at.COMPONENTS, function (c) {
                        if (!q.isUndefined(s[c]) && !q.isUndefined(this.__color.__state[c]) && s[c] !== this.__color.__state[c]) return r = !0, {}
                    }, this), r && q.extend(this.__color.__state, s)
                }
                q.extend(this.__temp.__state, this.__color.__state), this.__temp.a = 1;
                var i = this.__color.v < .5 || this.__color.s > .5 ? 255 : 0,
                    o = 255 - i;
                q.extend(this.__field_knob.style, {
                    marginLeft: 100 * this.__color.s - 7 + "px",
                    marginTop: 100 * (1 - this.__color.v) - 7 + "px",
                    backgroundColor: this.__temp.toHexString(),
                    border: this.__field_knob_border + "rgb(" + i + "," + i + "," + i + ")"
                }), this.__hue_knob.style.marginTop = (1 - this.__color.h / 360) * 100 + "px", this.__temp.s = 1, this.__temp.v = 1, $a(this.__saturation_field, "left", "#fff", this.__temp.toHexString()), this.__input.value = this.__color.toString(), q.extend(this.__input.style, {
                    backgroundColor: this.__color.toHexString(),
                    color: "rgb(" + i + "," + i + "," + i + ")",
                    textShadow: this.__input_textShadow + "rgba(" + o + "," + o + "," + o + ",.7)"
                })
            }
        }]), e
    }(us),
    df = ["-moz-", "-o-", "-webkit-", "-ms-", ""];

function $a(t, e, n, s) {
    t.style.background = "", q.each(df, function (r) {
        t.style.cssText += "background: " + r + "linear-gradient(" + e + ", " + n + " 0%, " + s + " 100%); "
    })
}

function pf(t) {
    t.style.background = "", t.style.cssText += "background: -moz-linear-gradient(top,  #ff0000 0%, #ff00ff 17%, #0000ff 34%, #00ffff 50%, #00ff00 67%, #ffff00 84%, #ff0000 100%);", t.style.cssText += "background: -webkit-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);", t.style.cssText += "background: -o-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);", t.style.cssText += "background: -ms-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);", t.style.cssText += "background: linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);"
}
var gf = {
    load: function (e, n) {
        var s = n || document,
            r = s.createElement("link");
        r.type = "text/css", r.rel = "stylesheet", r.href = e, s.getElementsByTagName("head")[0].appendChild(r)
    },
    inject: function (e, n) {
        var s = n || document,
            r = document.createElement("style");
        r.type = "text/css", r.innerHTML = e;
        var i = s.getElementsByTagName("head")[0];
        try {
            i.appendChild(r)
        } catch { }
    }
},
    mf = `<div id="dg-save" class="dg dialogue">

  Here's the new load parameter for your <code>GUI</code>'s constructor:

  <textarea id="dg-new-constructor"></textarea>

  <div id="dg-save-locally">

    <input id="dg-local-storage" type="checkbox"/> Automatically save
    values to <code>localStorage</code> on exit.

    <div id="dg-local-explain">The values saved to <code>localStorage</code> will
      override those passed to <code>dat.GUI</code>'s constructor. This makes it
      easier to work incrementally, but <code>localStorage</code> is fragile,
      and your friends may not see the same values you do.

    </div>

  </div>

</div>`,
    yf = function (e, n) {
        var s = e[n];
        return q.isArray(arguments[2]) || q.isObject(arguments[2]) ? new lf(e, n, arguments[2]) : q.isNumber(s) ? q.isNumber(arguments[2]) && q.isNumber(arguments[3]) ? q.isNumber(arguments[4]) ? new Xi(e, n, arguments[2], arguments[3], arguments[4]) : new Xi(e, n, arguments[2], arguments[3]) : q.isNumber(arguments[4]) ? new Vr(e, n, {
            min: arguments[2],
            max: arguments[3],
            step: arguments[4]
        }) : new Vr(e, n, {
            min: arguments[2],
            max: arguments[3]
        }) : q.isString(s) ? new ff(e, n) : q.isFunction(s) ? new Ou(e, n, "") : q.isBoolean(s) ? new Bu(e, n) : null
    };

function _f(t) {
    setTimeout(t, 1e3 / 60)
}
var wf = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || _f,
    vf = function () {
        function t() {
            rn(this, t), this.backgroundElement = document.createElement("div"), q.extend(this.backgroundElement.style, {
                backgroundColor: "rgba(0,0,0,0.8)",
                top: 0,
                left: 0,
                display: "none",
                zIndex: "1000",
                opacity: 0,
                WebkitTransition: "opacity 0.2s linear",
                transition: "opacity 0.2s linear"
            }), k.makeFullscreen(this.backgroundElement), this.backgroundElement.style.position = "fixed", this.domElement = document.createElement("div"), q.extend(this.domElement.style, {
                position: "fixed",
                display: "none",
                zIndex: "1001",
                opacity: 0,
                WebkitTransition: "-webkit-transform 0.2s ease-out, opacity 0.2s linear",
                transition: "transform 0.2s ease-out, opacity 0.2s linear"
            }), document.body.appendChild(this.backgroundElement), document.body.appendChild(this.domElement);
            var e = this;
            k.bind(this.backgroundElement, "click", function () {
                e.hide()
            })
        }
        return on(t, [{
            key: "show",
            value: function () {
                var n = this;
                this.backgroundElement.style.display = "block", this.domElement.style.display = "block", this.domElement.style.opacity = 0, this.domElement.style.webkitTransform = "scale(1.1)", this.layout(), q.defer(function () {
                    n.backgroundElement.style.opacity = 1, n.domElement.style.opacity = 1, n.domElement.style.webkitTransform = "scale(1)"
                })
            }
        }, {
            key: "hide",
            value: function () {
                var n = this,
                    s = function r() {
                        n.domElement.style.display = "none", n.backgroundElement.style.display = "none", k.unbind(n.domElement, "webkitTransitionEnd", r), k.unbind(n.domElement, "transitionend", r), k.unbind(n.domElement, "oTransitionEnd", r)
                    };
                k.bind(this.domElement, "webkitTransitionEnd", s), k.bind(this.domElement, "transitionend", s), k.bind(this.domElement, "oTransitionEnd", s), this.backgroundElement.style.opacity = 0, this.domElement.style.opacity = 0, this.domElement.style.webkitTransform = "scale(1.1)"
            }
        }, {
            key: "layout",
            value: function () {
                this.domElement.style.left = window.innerWidth / 2 - k.getWidth(this.domElement) / 2 + "px", this.domElement.style.top = window.innerHeight / 2 - k.getHeight(this.domElement) / 2 + "px"
            }
        }]), t
    }(),
    bf = rf(`.dg ul{list-style:none;margin:0;padding:0;width:100%;clear:both}.dg.ac{position:fixed;top:0;left:0;right:0;height:0;z-index:0}.dg:not(.ac) .main{overflow:hidden}.dg.main{-webkit-transition:opacity .1s linear;-o-transition:opacity .1s linear;-moz-transition:opacity .1s linear;transition:opacity .1s linear}.dg.main.taller-than-window{overflow-y:auto}.dg.main.taller-than-window .close-button{opacity:1;margin-top:-1px;border-top:1px solid #2c2c2c}.dg.main ul.closed .close-button{opacity:1 !important}.dg.main:hover .close-button,.dg.main .close-button.drag{opacity:1}.dg.main .close-button{-webkit-transition:opacity .1s linear;-o-transition:opacity .1s linear;-moz-transition:opacity .1s linear;transition:opacity .1s linear;border:0;line-height:19px;height:20px;cursor:pointer;text-align:center;background-color:#000}.dg.main .close-button.close-top{position:relative}.dg.main .close-button.close-bottom{position:absolute}.dg.main .close-button:hover{background-color:#111}.dg.a{float:right;margin-right:15px;overflow-y:visible}.dg.a.has-save>ul.close-top{margin-top:0}.dg.a.has-save>ul.close-bottom{margin-top:27px}.dg.a.has-save>ul.closed{margin-top:0}.dg.a .save-row{top:0;z-index:1002}.dg.a .save-row.close-top{position:relative}.dg.a .save-row.close-bottom{position:fixed}.dg li{-webkit-transition:height .1s ease-out;-o-transition:height .1s ease-out;-moz-transition:height .1s ease-out;transition:height .1s ease-out;-webkit-transition:overflow .1s linear;-o-transition:overflow .1s linear;-moz-transition:overflow .1s linear;transition:overflow .1s linear}.dg li:not(.folder){cursor:auto;height:27px;line-height:27px;padding:0 4px 0 5px}.dg li.folder{padding:0;border-left:4px solid rgba(0,0,0,0)}.dg li.title{cursor:pointer;margin-left:-4px}.dg .closed li:not(.title),.dg .closed ul li,.dg .closed ul li>*{height:0;overflow:hidden;border:0}.dg .cr{clear:both;padding-left:3px;height:27px;overflow:hidden}.dg .property-name{cursor:default;float:left;clear:left;width:40%;overflow:hidden;text-overflow:ellipsis}.dg .cr.function .property-name{width:100%}.dg .c{float:left;width:60%;position:relative}.dg .c input[type=text]{border:0;margin-top:4px;padding:3px;width:100%;float:right}.dg .has-slider input[type=text]{width:30%;margin-left:0}.dg .slider{float:left;width:66%;margin-left:-5px;margin-right:0;height:19px;margin-top:4px}.dg .slider-fg{height:100%}.dg .c input[type=checkbox]{margin-top:7px}.dg .c select{margin-top:5px}.dg .cr.function,.dg .cr.function .property-name,.dg .cr.function *,.dg .cr.boolean,.dg .cr.boolean *{cursor:pointer}.dg .cr.color{overflow:visible}.dg .selector{display:none;position:absolute;margin-left:-9px;margin-top:23px;z-index:10}.dg .c:hover .selector,.dg .selector.drag{display:block}.dg li.save-row{padding:0}.dg li.save-row .button{display:inline-block;padding:0px 6px}.dg.dialogue{background-color:#222;width:460px;padding:15px;font-size:13px;line-height:15px}#dg-new-constructor{padding:10px;color:#222;font-family:Monaco, monospace;font-size:10px;border:0;resize:none;box-shadow:inset 1px 1px 1px #888;word-wrap:break-word;margin:12px 0;display:block;width:440px;overflow-y:scroll;height:100px;position:relative}#dg-local-explain{display:none;font-size:11px;line-height:17px;border-radius:3px;background-color:#333;padding:8px;margin-top:10px}#dg-local-explain code{font-size:10px}#dat-gui-save-locally{display:none}.dg{color:#eee;font:11px 'Lucida Grande', sans-serif;text-shadow:0 -1px 0 #111}.dg.main::-webkit-scrollbar{width:5px;background:#1a1a1a}.dg.main::-webkit-scrollbar-corner{height:0;display:none}.dg.main::-webkit-scrollbar-thumb{border-radius:5px;background:#676767}.dg li:not(.folder){background:#1a1a1a;border-bottom:1px solid #2c2c2c}.dg li.save-row{line-height:25px;background:#dad5cb;border:0}.dg li.save-row select{margin-left:5px;width:108px}.dg li.save-row .button{margin-left:5px;margin-top:1px;border-radius:2px;font-size:9px;line-height:7px;padding:4px 4px 5px 4px;background:#c5bdad;color:#fff;text-shadow:0 1px 0 #b0a58f;box-shadow:0 -1px 0 #b0a58f;cursor:pointer}.dg li.save-row .button.gears{background:#c5bdad url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAANCAYAAAB/9ZQ7AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQJJREFUeNpiYKAU/P//PwGIC/ApCABiBSAW+I8AClAcgKxQ4T9hoMAEUrxx2QSGN6+egDX+/vWT4e7N82AMYoPAx/evwWoYoSYbACX2s7KxCxzcsezDh3evFoDEBYTEEqycggWAzA9AuUSQQgeYPa9fPv6/YWm/Acx5IPb7ty/fw+QZblw67vDs8R0YHyQhgObx+yAJkBqmG5dPPDh1aPOGR/eugW0G4vlIoTIfyFcA+QekhhHJhPdQxbiAIguMBTQZrPD7108M6roWYDFQiIAAv6Aow/1bFwXgis+f2LUAynwoIaNcz8XNx3Dl7MEJUDGQpx9gtQ8YCueB+D26OECAAQDadt7e46D42QAAAABJRU5ErkJggg==) 2px 1px no-repeat;height:7px;width:8px}.dg li.save-row .button:hover{background-color:#bab19e;box-shadow:0 -1px 0 #b0a58f}.dg li.folder{border-bottom:0}.dg li.title{padding-left:16px;background:#000 url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlI+hKgFxoCgAOw==) 6px 10px no-repeat;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.2)}.dg .closed li.title{background-image:url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlGIWqMCbWAEAOw==)}.dg .cr.boolean{border-left:3px solid #806787}.dg .cr.color{border-left:3px solid}.dg .cr.function{border-left:3px solid #e61d5f}.dg .cr.number{border-left:3px solid #2FA1D6}.dg .cr.number input[type=text]{color:#2FA1D6}.dg .cr.string{border-left:3px solid #1ed36f}.dg .cr.string input[type=text]{color:#1ed36f}.dg .cr.function:hover,.dg .cr.boolean:hover{background:#111}.dg .c input[type=text]{background:#303030;outline:none}.dg .c input[type=text]:hover{background:#3c3c3c}.dg .c input[type=text]:focus{background:#494949;color:#fff}.dg .c .slider{background:#303030;cursor:ew-resize}.dg .c .slider-fg{background:#2FA1D6;max-width:100%}.dg .c .slider:hover{background:#3c3c3c}.dg .c .slider:hover .slider-fg{background:#44abda}`);
gf.inject(bf);
var Xa = "dg",
    Ka = 72,
    Ja = 20,
    tr = "Default",
    Ws = function () {
        try {
            return !!window.localStorage
        } catch {
            return !1
        }
    }(),
    Xs = void 0,
    Za = !0,
    ps = void 0,
    Li = !1,
    Lu = [],
    ke = function t(e) {
        var n = this,
            s = e || {};
        this.domElement = document.createElement("div"), this.__ul = document.createElement("ul"), this.domElement.appendChild(this.__ul), k.addClass(this.domElement, Xa), this.__folders = {}, this.__controllers = [], this.__rememberedObjects = [], this.__rememberedObjectIndecesToControllers = [], this.__listening = [], s = q.defaults(s, {
            closeOnTop: !1,
            autoPlace: !0,
            width: t.DEFAULT_WIDTH
        }), s = q.defaults(s, {
            resizable: s.autoPlace,
            hideable: s.autoPlace
        }), q.isUndefined(s.load) ? s.load = {
            preset: tr
        } : s.preset && (s.load.preset = s.preset), q.isUndefined(s.parent) && s.hideable && Lu.push(this), s.resizable = q.isUndefined(s.parent) && s.resizable, s.autoPlace && q.isUndefined(s.scrollable) && (s.scrollable = !0);
        var r = Ws && localStorage.getItem(gs(this, "isLocal")) === "true",
            i = void 0,
            o = void 0;
        if (Object.defineProperties(this, {
            parent: {
                get: function () {
                    return s.parent
                }
            },
            scrollable: {
                get: function () {
                    return s.scrollable
                }
            },
            autoPlace: {
                get: function () {
                    return s.autoPlace
                }
            },
            closeOnTop: {
                get: function () {
                    return s.closeOnTop
                }
            },
            preset: {
                get: function () {
                    return n.parent ? n.getRoot().preset : s.load.preset
                },
                set: function (I) {
                    n.parent ? n.getRoot().preset = I : s.load.preset = I, Tf(this), n.revert()
                }
            },
            width: {
                get: function () {
                    return s.width
                },
                set: function (I) {
                    s.width = I, Qi(n, I)
                }
            },
            name: {
                get: function () {
                    return s.name
                },
                set: function (I) {
                    s.name = I, o && (o.innerHTML = s.name)
                }
            },
            closed: {
                get: function () {
                    return s.closed
                },
                set: function (I) {
                    s.closed = I, s.closed ? k.addClass(n.__ul, t.CLASS_CLOSED) : k.removeClass(n.__ul, t.CLASS_CLOSED), this.onResize(), n.__closeButton && (n.__closeButton.innerHTML = I ? t.TEXT_OPEN : t.TEXT_CLOSED)
                }
            },
            load: {
                get: function () {
                    return s.load
                }
            },
            useLocalStorage: {
                get: function () {
                    return r
                },
                set: function (I) {
                    Ws && (r = I, I ? k.bind(window, "unload", i) : k.unbind(window, "unload", i), localStorage.setItem(gs(n, "isLocal"), I))
                }
            }
        }), q.isUndefined(s.parent)) {
            if (this.closed = s.closed || !1, k.addClass(this.domElement, t.CLASS_MAIN), k.makeSelectable(this.domElement, !1), Ws && r) {
                n.useLocalStorage = !0;
                var c = localStorage.getItem(gs(this, "gui"));
                c && (s.load = JSON.parse(c))
            }
            this.__closeButton = document.createElement("div"), this.__closeButton.innerHTML = t.TEXT_CLOSED, k.addClass(this.__closeButton, t.CLASS_CLOSE_BUTTON), s.closeOnTop ? (k.addClass(this.__closeButton, t.CLASS_CLOSE_TOP), this.domElement.insertBefore(this.__closeButton, this.domElement.childNodes[0])) : (k.addClass(this.__closeButton, t.CLASS_CLOSE_BOTTOM), this.domElement.appendChild(this.__closeButton)), k.bind(this.__closeButton, "click", function () {
                n.closed = !n.closed
            })
        } else {
            s.closed === void 0 && (s.closed = !0);
            var f = document.createTextNode(s.name);
            k.addClass(f, "controller-name"), o = Bo(n, f);
            var _ = function (I) {
                return I.preventDefault(), n.closed = !n.closed, !1
            };
            k.addClass(this.__ul, t.CLASS_CLOSED), k.addClass(o, "title"), k.bind(o, "click", _), s.closed || (this.closed = !1)
        }
        s.autoPlace && (q.isUndefined(s.parent) && (Za && (ps = document.createElement("div"), k.addClass(ps, Xa), k.addClass(ps, t.CLASS_AUTO_PLACE_CONTAINER), document.body.appendChild(ps), Za = !1), ps.appendChild(this.domElement), k.addClass(this.domElement, t.CLASS_AUTO_PLACE)), this.parent || Qi(n, s.width)), this.__resizeHandler = function () {
            n.onResizeDebounced()
        }, k.bind(window, "resize", this.__resizeHandler), k.bind(this.__ul, "webkitTransitionEnd", this.__resizeHandler), k.bind(this.__ul, "transitionend", this.__resizeHandler), k.bind(this.__ul, "oTransitionEnd", this.__resizeHandler), this.onResize(), s.resizable && Af(this), i = function () {
            Ws && localStorage.getItem(gs(n, "isLocal")) === "true" && localStorage.setItem(gs(n, "gui"), JSON.stringify(n.getSaveObject()))
        }, this.saveToLocalStorageIfPossible = i;

        function M() {
            var A = n.getRoot();
            A.width += 1, q.defer(function () {
                A.width -= 1
            })
        }
        s.parent || M()
    };
ke.toggleHide = function () {
    Li = !Li, q.each(Lu, function (t) {
        t.domElement.style.display = Li ? "none" : ""
    })
};
ke.CLASS_AUTO_PLACE = "a";
ke.CLASS_AUTO_PLACE_CONTAINER = "ac";
ke.CLASS_MAIN = "main";
ke.CLASS_CONTROLLER_ROW = "cr";
ke.CLASS_TOO_TALL = "taller-than-window";
ke.CLASS_CLOSED = "closed";
ke.CLASS_CLOSE_BUTTON = "close-button";
ke.CLASS_CLOSE_TOP = "close-top";
ke.CLASS_CLOSE_BOTTOM = "close-bottom";
ke.CLASS_DRAG = "drag";
ke.DEFAULT_WIDTH = 245;
ke.TEXT_CLOSED = "Close Controls";
ke.TEXT_OPEN = "Open Controls";
ke._keydownHandler = function (t) {
    document.activeElement.type !== "text" && (t.which === Ka || t.keyCode === Ka) && ke.toggleHide()
};
k.bind(window, "keydown", ke._keydownHandler, !1);
q.extend(ke.prototype, {
    add: function (e, n) {
        return Ks(this, e, n, {
            factoryArgs: Array.prototype.slice.call(arguments, 2)
        })
    },
    addColor: function (e, n) {
        return Ks(this, e, n, {
            color: !0
        })
    },
    remove: function (e) {
        this.__ul.removeChild(e.__li), this.__controllers.splice(this.__controllers.indexOf(e), 1);
        var n = this;
        q.defer(function () {
            n.onResize()
        })
    },
    destroy: function () {
        if (this.parent) throw new Error("Only the root GUI should be removed with .destroy(). For subfolders, use gui.removeFolder(folder) instead.");
        this.autoPlace && ps.removeChild(this.domElement);
        var e = this;
        q.each(this.__folders, function (n) {
            e.removeFolder(n)
        }), k.unbind(window, "keydown", ke._keydownHandler, !1), Qa(this)
    },
    addFolder: function (e) {
        if (this.__folders[e] !== void 0) throw new Error('You already have a folder in this GUI by the name "' + e + '"');
        var n = {
            name: e,
            parent: this
        };
        n.autoPlace = this.autoPlace, this.load && this.load.folders && this.load.folders[e] && (n.closed = this.load.folders[e].closed, n.load = this.load.folders[e]);
        var s = new ke(n);
        this.__folders[e] = s;
        var r = Bo(this, s.domElement);
        return k.addClass(r, "folder"), s
    },
    removeFolder: function (e) {
        this.__ul.removeChild(e.domElement.parentElement), delete this.__folders[e.name], this.load && this.load.folders && this.load.folders[e.name] && delete this.load.folders[e.name], Qa(e);
        var n = this;
        q.each(e.__folders, function (s) {
            e.removeFolder(s)
        }), q.defer(function () {
            n.onResize()
        })
    },
    open: function () {
        this.closed = !1
    },
    close: function () {
        this.closed = !0
    },
    hide: function () {
        this.domElement.style.display = "none"
    },
    show: function () {
        this.domElement.style.display = ""
    },
    onResize: function () {
        var e = this.getRoot();
        if (e.scrollable) {
            var n = k.getOffset(e.__ul).top,
                s = 0;
            q.each(e.__ul.childNodes, function (r) {
                e.autoPlace && r === e.__save_row || (s += k.getHeight(r))
            }), window.innerHeight - n - Ja < s ? (k.addClass(e.domElement, ke.CLASS_TOO_TALL), e.__ul.style.height = window.innerHeight - n - Ja + "px") : (k.removeClass(e.domElement, ke.CLASS_TOO_TALL), e.__ul.style.height = "auto")
        }
        e.__resize_handle && q.defer(function () {
            e.__resize_handle.style.height = e.__ul.offsetHeight + "px"
        }), e.__closeButton && (e.__closeButton.style.width = e.width + "px")
    },
    onResizeDebounced: q.debounce(function () {
        this.onResize()
    }, 50),
    remember: function () {
        if (q.isUndefined(Xs) && (Xs = new vf, Xs.domElement.innerHTML = mf), this.parent) throw new Error("You can only call remember on a top level GUI.");
        var e = this;
        q.each(Array.prototype.slice.call(arguments), function (n) {
            e.__rememberedObjects.length === 0 && Ef(e), e.__rememberedObjects.indexOf(n) === -1 && e.__rememberedObjects.push(n)
        }), this.autoPlace && Qi(this, this.width)
    },
    getRoot: function () {
        for (var e = this; e.parent;) e = e.parent;
        return e
    },
    getSaveObject: function () {
        var e = this.load;
        return e.closed = this.closed, this.__rememberedObjects.length > 0 && (e.preset = this.preset, e.remembered || (e.remembered = {}), e.remembered[this.preset] = xr(this)), e.folders = {}, q.each(this.__folders, function (n, s) {
            e.folders[s] = n.getSaveObject()
        }), e
    },
    save: function () {
        this.load.remembered || (this.load.remembered = {}), this.load.remembered[this.preset] = xr(this), Ji(this, !1), this.saveToLocalStorageIfPossible()
    },
    saveAs: function (e) {
        this.load.remembered || (this.load.remembered = {}, this.load.remembered[tr] = xr(this, !0)), this.load.remembered[e] = xr(this), this.preset = e, Zi(this, e, !0), this.saveToLocalStorageIfPossible()
    },
    revert: function (e) {
        q.each(this.__controllers, function (n) {
            this.getRoot().load.remembered ? Nu(e || this.getRoot(), n) : n.setValue(n.initialValue), n.__onFinishChange && n.__onFinishChange.call(n, n.getValue())
        }, this), q.each(this.__folders, function (n) {
            n.revert(n)
        }), e || Ji(this.getRoot(), !1)
    },
    listen: function (e) {
        var n = this.__listening.length === 0;
        this.__listening.push(e), n && ku(this.__listening)
    },
    updateDisplay: function () {
        q.each(this.__controllers, function (e) {
            e.updateDisplay()
        }), q.each(this.__folders, function (e) {
            e.updateDisplay()
        })
    }
});

function Bo(t, e, n) {
    var s = document.createElement("li");
    return e && s.appendChild(e), n ? t.__ul.insertBefore(s, n) : t.__ul.appendChild(s), t.onResize(), s
}

function Qa(t) {
    k.unbind(window, "resize", t.__resizeHandler), t.saveToLocalStorageIfPossible && k.unbind(window, "unload", t.saveToLocalStorageIfPossible)
}

function Ji(t, e) {
    var n = t.__preset_select[t.__preset_select.selectedIndex];
    e ? n.innerHTML = n.value + "*" : n.innerHTML = n.value
}

function xf(t, e, n) {
    if (n.__li = e, n.__gui = t, q.extend(n, {
        options: function (o) {
            if (arguments.length > 1) {
                var c = n.__li.nextElementSibling;
                return n.remove(), Ks(t, n.object, n.property, {
                    before: c,
                    factoryArgs: [q.toArray(arguments)]
                })
            }
            if (q.isArray(o) || q.isObject(o)) {
                var f = n.__li.nextElementSibling;
                return n.remove(), Ks(t, n.object, n.property, {
                    before: f,
                    factoryArgs: [o]
                })
            }
        },
        name: function (o) {
            return n.__li.firstElementChild.firstElementChild.innerHTML = o, n
        },
        listen: function () {
            return n.__gui.listen(n), n
        },
        remove: function () {
            return n.__gui.remove(n), n
        }
    }), n instanceof Xi) {
        var s = new Vr(n.object, n.property, {
            min: n.__min,
            max: n.__max,
            step: n.__step
        });
        q.each(["updateDisplay", "onChange", "onFinishChange", "step", "min", "max"], function (i) {
            var o = n[i],
                c = s[i];
            n[i] = s[i] = function () {
                var f = Array.prototype.slice.call(arguments);
                return c.apply(s, f), o.apply(n, f)
            }
        }), k.addClass(e, "has-slider"), n.domElement.insertBefore(s.domElement, n.domElement.firstElementChild)
    } else if (n instanceof Vr) {
        var r = function (o) {
            if (q.isNumber(n.__min) && q.isNumber(n.__max)) {
                var c = n.__li.firstElementChild.firstElementChild.innerHTML,
                    f = n.__gui.__listening.indexOf(n) > -1;
                n.remove();
                var _ = Ks(t, n.object, n.property, {
                    before: n.__li.nextElementSibling,
                    factoryArgs: [n.__min, n.__max, n.__step]
                });
                return _.name(c), f && _.listen(), _
            }
            return o
        };
        n.min = q.compose(r, n.min), n.max = q.compose(r, n.max)
    } else n instanceof Bu ? (k.bind(e, "click", function () {
        k.fakeEvent(n.__checkbox, "click")
    }), k.bind(n.__checkbox, "click", function (i) {
        i.stopPropagation()
    })) : n instanceof Ou ? (k.bind(e, "click", function () {
        k.fakeEvent(n.__button, "click")
    }), k.bind(e, "mouseover", function () {
        k.addClass(n.__button, "hover")
    }), k.bind(e, "mouseout", function () {
        k.removeClass(n.__button, "hover")
    })) : n instanceof Ki && (k.addClass(e, "color"), n.updateDisplay = q.compose(function (i) {
        return e.style.borderLeftColor = n.__color.toString(), i
    }, n.updateDisplay), n.updateDisplay());
    n.setValue = q.compose(function (i) {
        return t.getRoot().__preset_select && n.isModified() && Ji(t.getRoot(), !0), i
    }, n.setValue)
}

function Nu(t, e) {
    var n = t.getRoot(),
        s = n.__rememberedObjects.indexOf(e.object);
    if (s !== -1) {
        var r = n.__rememberedObjectIndecesToControllers[s];
        if (r === void 0 && (r = {}, n.__rememberedObjectIndecesToControllers[s] = r), r[e.property] = e, n.load && n.load.remembered) {
            var i = n.load.remembered,
                o = void 0;
            if (i[t.preset]) o = i[t.preset];
            else if (i[tr]) o = i[tr];
            else return;
            if (o[s] && o[s][e.property] !== void 0) {
                var c = o[s][e.property];
                e.initialValue = c, e.setValue(c)
            }
        }
    }
}

function Ks(t, e, n, s) {
    if (e[n] === void 0) throw new Error('Object "' + e + '" has no property "' + n + '"');
    var r = void 0;
    if (s.color) r = new Ki(e, n);
    else {
        var i = [e, n].concat(s.factoryArgs);
        r = yf.apply(t, i)
    }
    s.before instanceof us && (s.before = s.before.__li), Nu(t, r), k.addClass(r.domElement, "c");
    var o = document.createElement("span");
    k.addClass(o, "property-name"), o.innerHTML = r.property;
    var c = document.createElement("div");
    c.appendChild(o), c.appendChild(r.domElement);
    var f = Bo(t, c, s.before);
    return k.addClass(f, ke.CLASS_CONTROLLER_ROW), r instanceof Ki ? k.addClass(f, "color") : k.addClass(f, af(r.getValue())), xf(t, f, r), t.__controllers.push(r), r
}

function gs(t, e) {
    return document.location.href + "." + e
}

function Zi(t, e, n) {
    var s = document.createElement("option");
    s.innerHTML = e, s.value = e, t.__preset_select.appendChild(s), n && (t.__preset_select.selectedIndex = t.__preset_select.length - 1)
}

function ec(t, e) {
    e.style.display = t.useLocalStorage ? "block" : "none"
}

function Ef(t) {
    var e = t.__save_row = document.createElement("li");
    k.addClass(t.domElement, "has-save"), t.__ul.insertBefore(e, t.__ul.firstChild), k.addClass(e, "save-row");
    var n = document.createElement("span");
    n.innerHTML = "&nbsp;", k.addClass(n, "button gears");
    var s = document.createElement("span");
    s.innerHTML = "Save", k.addClass(s, "button"), k.addClass(s, "save");
    var r = document.createElement("span");
    r.innerHTML = "New", k.addClass(r, "button"), k.addClass(r, "save-as");
    var i = document.createElement("span");
    i.innerHTML = "Revert", k.addClass(i, "button"), k.addClass(i, "revert");
    var o = t.__preset_select = document.createElement("select");
    if (t.load && t.load.remembered ? q.each(t.load.remembered, function (A, I) {
        Zi(t, I, I === t.preset)
    }) : Zi(t, tr, !1), k.bind(o, "change", function () {
        for (var A = 0; A < t.__preset_select.length; A++) t.__preset_select[A].innerHTML = t.__preset_select[A].value;
        t.preset = this.value
    }), e.appendChild(o), e.appendChild(n), e.appendChild(s), e.appendChild(r), e.appendChild(i), Ws) {
        var c = document.getElementById("dg-local-explain"),
            f = document.getElementById("dg-local-storage"),
            _ = document.getElementById("dg-save-locally");
        _.style.display = "block", localStorage.getItem(gs(t, "isLocal")) === "true" && f.setAttribute("checked", "checked"), ec(t, c), k.bind(f, "change", function () {
            t.useLocalStorage = !t.useLocalStorage, ec(t, c)
        })
    }
    var M = document.getElementById("dg-new-constructor");
    k.bind(M, "keydown", function (A) {
        A.metaKey && (A.which === 67 || A.keyCode === 67) && Xs.hide()
    }), k.bind(n, "click", function () {
        M.innerHTML = JSON.stringify(t.getSaveObject(), void 0, 2), Xs.show(), M.focus(), M.select()
    }), k.bind(s, "click", function () {
        t.save()
    }), k.bind(r, "click", function () {
        var A = prompt("Enter a new preset name.");
        A && t.saveAs(A)
    }), k.bind(i, "click", function () {
        t.revert()
    })
}

function Af(t) {
    var e = void 0;
    t.__resize_handle = document.createElement("div"), q.extend(t.__resize_handle.style, {
        width: "6px",
        marginLeft: "-3px",
        height: "200px",
        cursor: "ew-resize",
        position: "absolute"
    });

    function n(i) {
        return i.preventDefault(), t.width += e - i.clientX, t.onResize(), e = i.clientX, !1
    }

    function s() {
        k.removeClass(t.__closeButton, ke.CLASS_DRAG), k.unbind(window, "mousemove", n), k.unbind(window, "mouseup", s)
    }

    function r(i) {
        return i.preventDefault(), e = i.clientX, k.addClass(t.__closeButton, ke.CLASS_DRAG), k.bind(window, "mousemove", n), k.bind(window, "mouseup", s), !1
    }
    k.bind(t.__resize_handle, "mousedown", r), k.bind(t.__closeButton, "mousedown", r), t.domElement.insertBefore(t.__resize_handle, t.domElement.firstElementChild)
}

function Qi(t, e) {
    t.domElement.style.width = e + "px", t.__save_row && t.autoPlace && (t.__save_row.style.width = e + "px"), t.__closeButton && (t.__closeButton.style.width = e + "px")
}

function xr(t, e) {
    var n = {};
    return q.each(t.__rememberedObjects, function (s, r) {
        var i = {},
            o = t.__rememberedObjectIndecesToControllers[r];
        q.each(o, function (c, f) {
            i[f] = e ? c.initialValue : c.getValue()
        }), n[r] = i
    }), n
}

function Tf(t) {
    for (var e = 0; e < t.__preset_select.length; e++) t.__preset_select[e].value === t.preset && (t.__preset_select.selectedIndex = e)
}

function ku(t) {
    t.length !== 0 && wf.call(window, function () {
        ku(t)
    }), q.each(t, function (e) {
        e.updateDisplay()
    })
}
var Sf = ke;
const tc = `@group(0) @binding(0) var<uniform> viewMatrix : mat4x4<f32>;
@group(0) @binding(1) var<uniform> projectionMatrix : mat4x4<f32>;
@group(0) @binding(2) var<uniform> canvasSize : vec2<f32>;
@group(0) @binding(3) var<uniform> uTime : f32;
@group(0) @binding(4) var<uniform> modelMatrix : mat4x4<f32>;
@group(0) @binding(5) var<uniform> uTestValue : f32;
@group(0) @binding(6) var<uniform> uTestValue_02 : f32;
@group(0) @binding(7) var mySampler: sampler;
@group(0) @binding(8) var myTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(3) uv : vec2f,
}

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) frag_normal : vec3f,
  @location(2) frag_uv : vec2f,
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
  let translateYMatrix = mat4x4<f32>(
    1.0, 0.0, 0.0, 0.0,  // Scale X by 1.0
    0.0, 1.0, 0.0, 0.0,  // Scale Y by 1.0
    0.0, 0.0, 1.0, 0.0,  // Scale Z by 1.0
    0.0, uTestValue_02, 0.0, 1.0   // Translation along Y-axis
  );

  var transformedModelMatrix = modelMatrix * translateYMatrix;

  return VertexOutput(
    projectionMatrix * viewMatrix * transformedModelMatrix * vec4f(input.position, 1.0), 
    input.normal,
    input.uv,
  );
}

struct FragmentInput {
  @builtin(position) Position : vec4f,
  @location(0) frag_normal : vec3f,
  @location(2) frag_uv : vec2f,
}

@fragment
fn fragment_main(input: FragmentInput) -> @location(0) vec4f {
  var finalColor: vec4f = textureSample(myTexture, mySampler, input.frag_uv);
  finalColor *= uTestValue;
  return finalColor;
}`;
class Uu {
    constructor() {
        N(this, "matrix_", new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
        N(this, "view_", Pt.create());
        N(this, "right_", new Float32Array(this.matrix_.buffer, 4 * 0, 4));
        N(this, "up_", new Float32Array(this.matrix_.buffer, 4 * 4, 4));
        N(this, "back_", new Float32Array(this.matrix_.buffer, 4 * 8, 4));
        N(this, "position_", new Float32Array(this.matrix_.buffer, 4 * 12, 4))
    }
    get matrix() {
        return this.matrix_
    }
    set matrix(e) {
        Pt.copy(e, this.matrix_)
    }
    get view() {
        return this.view_
    }
    set view(e) {
        Pt.copy(e, this.view_)
    }
    get right() {
        return this.right_
    }
    set right(e) {
        ve.copy(e, this.right_)
    }
    get up() {
        return this.up_
    }
    set up(e) {
        ve.copy(e, this.up_)
    }
    get back() {
        return this.back_
    }
    set back(e) {
        ve.copy(e, this.back_)
    }
    get position() {
        return this.position_
    }
    set position(e) {
        ve.copy(e, this.position_)
    }
}
class Mf extends Uu {
    constructor(n) {
        super();
        N(this, "pitch", 0);
        N(this, "yaw", 0);
        N(this, "velocity_", ve.create());
        N(this, "movementSpeed", 10);
        N(this, "rotationSpeed", 1);
        N(this, "frictionCoefficient", .99);
        if (n && (n.position || n.target)) {
            const s = n.position ?? ve.create(0, 0, -5),
                r = n.target ?? ve.create(0, 0, 0),
                i = ve.normalize(ve.sub(s, r));
            this.recalculateAngles(i), this.position = s
        }
    }
    get velocity() {
        return this.velocity_
    }
    set velocity(n) {
        ve.copy(n, this.velocity_)
    }
    get matrix() {
        return super.matrix
    }
    set matrix(n) {
        super.matrix = n, this.recalculateAngles(this.back)
    }
    update(n, s) {
        const r = (A, I) => (A ? 1 : 0) - (I ? 1 : 0);
        this.yaw -= s.analog.x * n * this.rotationSpeed, this.pitch -= s.analog.y * n * this.rotationSpeed, this.yaw = Bf(this.yaw, Math.PI * 2), this.pitch = Pf(this.pitch, -Math.PI / 2, Math.PI / 2);
        const i = ve.copy(this.position);
        super.matrix = Pt.rotateX(Pt.rotationY(this.yaw), this.pitch);
        const o = s.digital,
            c = r(o.right, o.left),
            f = r(o.up, o.down),
            _ = ve.create(),
            M = r(o.backward, o.forward);
        return ve.addScaled(_, this.right, c, _), ve.addScaled(_, this.up, f, _), ve.addScaled(_, this.back, M, _), ve.normalize(_, _), ve.mulScalar(_, this.movementSpeed, _), this.velocity = Of(_, this.velocity, Math.pow(1 - this.frictionCoefficient, n)), this.position = ve.addScaled(i, this.velocity, n), this.view = Pt.invert(this.matrix), this.view
    }
    recalculateAngles(n) {
        this.yaw = Math.atan2(n[0], n[2]), this.pitch = -Math.asin(n[1])
    }
}
class Rf extends Uu {
    constructor(n) {
        super();
        N(this, "distance", 0);
        N(this, "angularVelocity", 0);
        N(this, "axis_", ve.create());
        N(this, "rotationSpeed", 1);
        N(this, "zoomSpeed", .1);
        N(this, "frictionCoefficient", .999);
        n && n.position && (this.position = n.position, this.distance = ve.len(this.position), this.back = ve.normalize(this.position), this.recalcuateRight(), this.recalcuateUp())
    }
    get axis() {
        return this.axis_
    }
    set axis(n) {
        ve.copy(n, this.axis_)
    }
    get matrix() {
        return super.matrix
    }
    set matrix(n) {
        super.matrix = n, this.distance = ve.len(this.position)
    }
    update(n, s) {
        s.analog.touching ? this.angularVelocity = 0 : this.angularVelocity *= Math.pow(1 - this.frictionCoefficient, n);
        const i = ve.create();
        ve.addScaled(i, this.right, s.analog.x, i), ve.addScaled(i, this.up, -s.analog.y, i);
        const o = ve.cross(i, this.back),
            c = ve.len(o);
        c > 1e-7 && (this.axis = ve.scale(o, 1 / c), this.angularVelocity = c * this.rotationSpeed);
        const f = this.angularVelocity * n;
        return f > 1e-7 && (this.back = ve.normalize(If(this.back, this.axis, f)), this.recalcuateRight(), this.recalcuateUp()), s.analog.zoom !== 0 && (this.distance *= 1 + s.analog.zoom * this.zoomSpeed), this.position = ve.scale(this.back, this.distance), this.view = Pt.invert(this.matrix), this.view
    }
    recalcuateRight() {
        this.right = ve.normalize(ve.cross(this.up, this.back))
    }
    recalcuateUp() {
        this.up = ve.normalize(ve.cross(this.back, this.right))
    }
}

function Pf(t, e, n) {
    return Math.min(Math.max(t, e), n)
}

function Bf(t, e) {
    return t - Math.floor(Math.abs(t) / e) * e * Math.sign(t)
}

function If(t, e, n) {
    return ve.transformMat4Upper3x3(t, Pt.rotation(e, n))
}

function Of(t, e, n) {
    return ve.addScaled(t, ve.sub(e, t), n)
}

function Lf(t, e) {
    const n = {
        forward: !1,
        backward: !1,
        left: !1,
        right: !1,
        up: !1,
        down: !1
    },
        s = {
            x: 0,
            y: 0,
            zoom: 0
        };
    let r = !1;
    const i = new Map;
    let o = 0;
    const c = (f, _) => {
        switch (f.code) {
            case "KeyW":
                n.forward = _, f.preventDefault(), f.stopPropagation();
                break;
            case "KeyS":
                n.backward = _, f.preventDefault(), f.stopPropagation();
                break;
            case "KeyA":
                n.left = _, f.preventDefault(), f.stopPropagation();
                break;
            case "KeyD":
                n.right = _, f.preventDefault(), f.stopPropagation();
                break;
            case "Space":
                n.up = _, f.preventDefault(), f.stopPropagation();
                break;
            case "ShiftLeft":
            case "ControlLeft":
            case "KeyC":
                n.down = _, f.preventDefault(), f.stopPropagation();
                break
        }
    };
    return t.addEventListener("keydown", f => c(f, !0)), t.addEventListener("keyup", f => c(f, !1)), e.style.touchAction = "none", e.addEventListener("pointerdown", f => {
        r = !0, f.pointerType === "touch" && i.set(f.pointerId, {
            x: f.clientX,
            y: f.clientY
        }), f.preventDefault()
    }), e.addEventListener("pointerup", f => {
        r = !1, f.pointerType === "touch" && (i.delete(f.pointerId), o = 0), f.preventDefault()
    }), e.addEventListener("pointermove", f => {
        if (r = f.pointerType == "mouse" ? (f.buttons & 1) !== 0 : !0, r && (s.x += f.movementX, s.y += f.movementY), f.pointerType === "touch" && i.has(f.pointerId) && (i.set(f.pointerId, {
            x: f.clientX,
            y: f.clientY
        }), i.size === 2)) {
            const _ = Array.from(i.values()),
                M = _[0].x - _[1].x,
                A = _[0].y - _[1].y,
                I = Math.sqrt(M * M + A * A);
            if (o === 0) o = I;
            else {
                const H = I - o;
                s.zoom += H * -.05, o = I
            }
        }
        f.preventDefault()
    }), e.addEventListener("wheel", f => {
        r = (f.buttons & 1) !== 0, s.zoom += Math.sign(f.deltaY), f.preventDefault(), f.stopPropagation()
    }, {
        passive: !1
    }), () => {
        const f = {
            digital: n,
            analog: {
                x: s.x,
                y: s.y,
                zoom: s.zoom,
                touching: r
            }
        };
        return s.x = 0, s.y = 0, s.zoom = 0, f
    }
}
const Nf = "modulepreload",
    kf = function (t) {
        return "/" + t
    },
    nc = {},
    sc = function (e, n, s) {
        let r = Promise.resolve();
        if (n && n.length > 0) {
            document.getElementsByTagName("link");
            const o = document.querySelector("meta[property=csp-nonce]"),
                c = (o == null ? void 0 : o.nonce) || (o == null ? void 0 : o.getAttribute("nonce"));
            r = Promise.allSettled(n.map(f => {
                if (f = kf(f), f in nc) return;
                nc[f] = !0;
                const _ = f.endsWith(".css"),
                    M = _ ? '[rel="stylesheet"]' : "";
                if (document.querySelector(`link[href="${f}"]${M}`)) return;
                const A = document.createElement("link");
                if (A.rel = _ ? "stylesheet" : Nf, _ || (A.as = "script"), A.crossOrigin = "", A.href = f, c && A.setAttribute("nonce", c), document.head.appendChild(A), _) return new Promise((I, H) => {
                    A.addEventListener("load", I), A.addEventListener("error", () => H(new Error(`Unable to preload CSS for ${f}`)))
                })
            }))
        }

        function i(o) {
            const c = new Event("vite:preloadError", {
                cancelable: !0
            });
            if (c.payload = o, window.dispatchEvent(c), !c.defaultPrevented) throw o
        }
        return r.then(o => {
            for (const c of o || []) c.status === "rejected" && i(c.reason);
            return e().catch(i)
        })
    };
class Fu {
    constructor() {
        this._listeners = {}
    }
    addEventListener(e, n) {
        const s = this._listeners;
        return s[e] === void 0 && (s[e] = []), s[e].indexOf(n) === -1 && s[e].push(n), this
    }
    removeEventListener(e, n) {
        const r = this._listeners[e];
        if (r !== void 0) {
            const i = r.indexOf(n);
            i !== -1 && r.splice(i, 1)
        }
        return this
    }
    dispatchEvent(e) {
        const s = this._listeners[e.type];
        if (s !== void 0) {
            const r = s.slice(0);
            for (let i = 0, o = r.length; i < o; i++) r[i].call(this, e)
        }
        return this
    }
    dispose() {
        for (const e in this._listeners) delete this._listeners[e]
    }
}
class ys {
    constructor(e, n, s, r = {}) {
        if (this._name = void 0, this._parent = void 0, this._child = void 0, this._attributes = void 0, this._disposed = !1, this._name = e, this._parent = n, this._child = s, this._attributes = r, !n.isOnGraph(s)) throw new Error("Cannot connect disconnected graphs.")
    }
    getName() {
        return this._name
    }
    getParent() {
        return this._parent
    }
    getChild() {
        return this._child
    }
    setChild(e) {
        return this._child = e, this
    }
    getAttributes() {
        return this._attributes
    }
    dispose() {
        this._disposed || (this._parent._destroyRef(this), this._disposed = !0)
    }
    isDisposed() {
        return this._disposed
    }
}
class Uf extends Fu {
    constructor(...e) {
        super(...e), this._emptySet = new Set, this._edges = new Set, this._parentEdges = new Map, this._childEdges = new Map
    }
    listEdges() {
        return Array.from(this._edges)
    }
    listParentEdges(e) {
        return Array.from(this._childEdges.get(e) || this._emptySet)
    }
    listParents(e) {
        const n = new Set;
        for (const s of this.listParentEdges(e)) n.add(s.getParent());
        return Array.from(n)
    }
    listChildEdges(e) {
        return Array.from(this._parentEdges.get(e) || this._emptySet)
    }
    listChildren(e) {
        const n = new Set;
        for (const s of this.listChildEdges(e)) n.add(s.getChild());
        return Array.from(n)
    }
    disconnectParents(e, n) {
        for (const s of this.listParentEdges(e)) (!n || n(s.getParent())) && s.dispose();
        return this
    }
    _createEdge(e, n, s, r) {
        const i = new ys(e, n, s, r);
        this._edges.add(i);
        const o = i.getParent();
        this._parentEdges.has(o) || this._parentEdges.set(o, new Set), this._parentEdges.get(o).add(i);
        const c = i.getChild();
        return this._childEdges.has(c) || this._childEdges.set(c, new Set), this._childEdges.get(c).add(i), i
    }
    _destroyEdge(e) {
        return this._edges.delete(e), this._parentEdges.get(e.getParent()).delete(e), this._childEdges.get(e.getChild()).delete(e), this
    }
}

function Js() {
    return Js = Object.assign || function (t) {
        for (var e = 1; e < arguments.length; e++) {
            var n = arguments[e];
            for (var s in n) Object.prototype.hasOwnProperty.call(n, s) && (t[s] = n[s])
        }
        return t
    }, Js.apply(this, arguments)
}
class kn {
    constructor(e) {
        if (this.list = [], e)
            for (const n of e) this.list.push(n)
    }
    add(e) {
        this.list.push(e)
    }
    remove(e) {
        const n = this.list.indexOf(e);
        n >= 0 && this.list.splice(n, 1)
    }
    removeChild(e) {
        const n = [];
        for (const s of this.list) s.getChild() === e && n.push(s);
        for (const s of n) this.remove(s);
        return n
    }
    listRefsByChild(e) {
        const n = [];
        for (const s of this.list) s.getChild() === e && n.push(s);
        return n
    }
    values() {
        return this.list
    }
}
class Ge {
    constructor(e) {
        if (this.set = new Set, this.map = new Map, e)
            for (const n of e) this.add(n)
    }
    add(e) {
        const n = e.getChild();
        this.removeChild(n), this.set.add(e), this.map.set(n, e)
    }
    remove(e) {
        this.set.delete(e), this.map.delete(e.getChild())
    }
    removeChild(e) {
        const n = this.map.get(e) || null;
        return n && this.remove(n), n
    }
    getRefByChild(e) {
        return this.map.get(e) || null
    }
    values() {
        return Array.from(this.set)
    }
}
class yn {
    constructor(e) {
        this.map = {}, e && Object.assign(this.map, e)
    }
    set(e, n) {
        this.map[e] = n
    }
    delete(e) {
        delete this.map[e]
    }
    get(e) {
        return this.map[e] || null
    }
    keys() {
        return Object.keys(this.map)
    }
    values() {
        return Object.values(this.map)
    }
}
const Me = Symbol("attributes"),
    Jn = Symbol("immutableKeys");
class Io extends Fu {
    constructor(e) {
        super(), this._disposed = !1, this.graph = void 0, this[Me] = void 0, this[Jn] = void 0, this.graph = e, this[Jn] = new Set, this[Me] = this._createAttributes()
    }
    getDefaults() {
        return {}
    }
    _createAttributes() {
        const e = this.getDefaults(),
            n = {};
        for (const s in e) {
            const r = e[s];
            if (r instanceof Io) {
                const i = this.graph._createEdge(s, this, r);
                this[Jn].add(s), n[s] = i
            } else n[s] = r
        }
        return n
    }
    isOnGraph(e) {
        return this.graph === e.graph
    }
    isDisposed() {
        return this._disposed
    }
    dispose() {
        this._disposed || (this.graph.listChildEdges(this).forEach(e => e.dispose()), this.graph.disconnectParents(this), this._disposed = !0, this.dispatchEvent({
            type: "dispose"
        }))
    }
    detach() {
        return this.graph.disconnectParents(this), this
    }
    swap(e, n) {
        for (const s in this[Me]) {
            const r = this[Me][s];
            if (r instanceof ys) {
                const i = r;
                i.getChild() === e && this.setRef(s, n, i.getAttributes())
            } else if (r instanceof kn)
                for (const i of r.listRefsByChild(e)) {
                    const o = i.getAttributes();
                    this.removeRef(s, e), this.addRef(s, n, o)
                } else if (r instanceof Ge) {
                    const i = r.getRefByChild(e);
                    if (i) {
                        const o = i.getAttributes();
                        this.removeRef(s, e), this.addRef(s, n, o)
                    }
                } else if (r instanceof yn)
                for (const i of r.keys()) {
                    const o = r.get(i);
                    o.getChild() === e && this.setRefMap(s, i, n, o.getAttributes())
                }
        }
        return this
    }
    get(e) {
        return this[Me][e]
    }
    set(e, n) {
        return this[Me][e] = n, this.dispatchEvent({
            type: "change",
            attribute: e
        })
    }
    getRef(e) {
        const n = this[Me][e];
        return n ? n.getChild() : null
    }
    setRef(e, n, s) {
        if (this[Jn].has(e)) throw new Error(`Cannot overwrite immutable attribute, "${e}".`);
        const r = this[Me][e];
        if (r && r.dispose(), !n) return this;
        const i = this.graph._createEdge(e, this, n, s);
        return this[Me][e] = i, this.dispatchEvent({
            type: "change",
            attribute: e
        })
    }
    listRefs(e) {
        return this.assertRefList(e).values().map(s => s.getChild())
    }
    addRef(e, n, s) {
        const r = this.graph._createEdge(e, this, n, s);
        return this.assertRefList(e).add(r), this.dispatchEvent({
            type: "change",
            attribute: e
        })
    }
    removeRef(e, n) {
        const s = this.assertRefList(e);
        if (s instanceof kn)
            for (const r of s.listRefsByChild(n)) r.dispose();
        else {
            const r = s.getRefByChild(n);
            r && r.dispose()
        }
        return this
    }
    assertRefList(e) {
        const n = this[Me][e];
        if (n instanceof kn || n instanceof Ge) return n;
        throw new Error(`Expected RefList or RefSet for attribute "${e}"`)
    }
    listRefMapKeys(e) {
        return this.assertRefMap(e).keys()
    }
    listRefMapValues(e) {
        return this.assertRefMap(e).values().map(n => n.getChild())
    }
    getRefMap(e, n) {
        const r = this.assertRefMap(e).get(n);
        return r ? r.getChild() : null
    }
    setRefMap(e, n, s, r) {
        const i = this.assertRefMap(e),
            o = i.get(n);
        if (o && o.dispose(), !s) return this;
        r = Object.assign(r || {}, {
            key: n
        });
        const c = this.graph._createEdge(e, this, s, Js({}, r, {
            key: n
        }));
        return i.set(n, c), this.dispatchEvent({
            type: "change",
            attribute: e,
            key: n
        })
    }
    assertRefMap(e) {
        const n = this[Me][e];
        if (n instanceof yn) return n;
        throw new Error(`Expected RefMap for attribute "${e}"`)
    }
    dispatchEvent(e) {
        return super.dispatchEvent(Js({}, e, {
            target: this
        })), this.graph.dispatchEvent(Js({}, e, {
            target: this,
            type: `node:${e.type}`
        })), this
    }
    _destroyRef(e) {
        const n = e.getName();
        if (this[Me][n] === e) this[Me][n] = null, this[Jn].has(n) && e.getChild().dispose();
        else if (this[Me][n] instanceof kn) this[Me][n].remove(e);
        else if (this[Me][n] instanceof Ge) this[Me][n].remove(e);
        else if (this[Me][n] instanceof yn) {
            const s = this[Me][n];
            for (const r of s.keys()) s.get(r) === e && s.delete(r)
        } else return;
        this.graph._destroyEdge(e), this.dispatchEvent({
            type: "change",
            attribute: n
        })
    }
}
const Cu = "v4.1.3",
    zr = "@glb.bin";
var de;
(function (t) {
    t.ACCESSOR = "Accessor", t.ANIMATION = "Animation", t.ANIMATION_CHANNEL = "AnimationChannel", t.ANIMATION_SAMPLER = "AnimationSampler", t.BUFFER = "Buffer", t.CAMERA = "Camera", t.MATERIAL = "Material", t.MESH = "Mesh", t.PRIMITIVE = "Primitive", t.PRIMITIVE_TARGET = "PrimitiveTarget", t.NODE = "Node", t.ROOT = "Root", t.SCENE = "Scene", t.SKIN = "Skin", t.TEXTURE = "Texture", t.TEXTURE_INFO = "TextureInfo"
})(de || (de = {}));
var jr;
(function (t) {
    t.INTERLEAVED = "interleaved", t.SEPARATE = "separate"
})(jr || (jr = {}));
var zt;
(function (t) {
    t.ARRAY_BUFFER = "ARRAY_BUFFER", t.ELEMENT_ARRAY_BUFFER = "ELEMENT_ARRAY_BUFFER", t.INVERSE_BIND_MATRICES = "INVERSE_BIND_MATRICES", t.OTHER = "OTHER", t.SPARSE = "SPARSE"
})(zt || (zt = {}));
var eo;
(function (t) {
    t[t.R = 4096] = "R", t[t.G = 256] = "G", t[t.B = 16] = "B", t[t.A = 1] = "A"
})(eo || (eo = {}));
var Tn;
(function (t) {
    t.GLTF = "GLTF", t.GLB = "GLB"
})(Tn || (Tn = {}));
const ei = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array
};
var to = typeof Float32Array < "u" ? Float32Array : Array;
Math.hypot || (Math.hypot = function () {
    for (var t = 0, e = arguments.length; e--;) t += arguments[e] * arguments[e];
    return Math.sqrt(t)
});

function Ff() {
    var t = new to(3);
    return to != Float32Array && (t[0] = 0, t[1] = 0, t[2] = 0), t
}

function Ni(t) {
    var e = t[0],
        n = t[1],
        s = t[2];
    return Math.hypot(e, n, s)
} (function () {
    var t = Ff();
    return function (e, n, s, r, i, o) {
        var c, f;
        for (n || (n = 3), s || (s = 0), r ? f = Math.min(r * n + s, e.length) : f = e.length, c = s; c < f; c += n) t[0] = e[c], t[1] = e[c + 1], t[2] = e[c + 2], i(t, t, o), e[c] = t[0], e[c + 1] = t[1], e[c + 2] = t[2];
        return e
    }
})();
class Te {
    static createBufferFromDataURI(e) {
        if (typeof Buffer > "u") {
            const n = atob(e.split(",")[1]),
                s = new Uint8Array(n.length);
            for (let r = 0; r < n.length; r++) s[r] = n.charCodeAt(r);
            return s
        } else {
            const n = e.split(",")[1],
                s = e.indexOf("base64") >= 0;
            return Buffer.from(n, s ? "base64" : "utf8")
        }
    }
    static encodeText(e) {
        return new TextEncoder().encode(e)
    }
    static decodeText(e) {
        return new TextDecoder().decode(e)
    }
    static concat(e) {
        let n = 0;
        for (const i of e) n += i.byteLength;
        const s = new Uint8Array(n);
        let r = 0;
        for (const i of e) s.set(i, r), r += i.byteLength;
        return s
    }
    static pad(e, n = 0) {
        const s = this.padNumber(e.byteLength);
        if (s === e.byteLength) return e;
        const r = new Uint8Array(s);
        if (r.set(e), n !== 0)
            for (let i = e.byteLength; i < s; i++) r[i] = n;
        return r
    }
    static padNumber(e) {
        return Math.ceil(e / 4) * 4
    }
    static equals(e, n) {
        if (e === n) return !0;
        if (e.byteLength !== n.byteLength) return !1;
        let s = e.byteLength;
        for (; s--;)
            if (e[s] !== n[s]) return !1;
        return !0
    }
    static toView(e, n = 0, s = 1 / 0) {
        return new Uint8Array(e.buffer, e.byteOffset + n, Math.min(e.byteLength, s))
    }
    static assertView(e) {
        if (e && !ArrayBuffer.isView(e)) throw new Error(`Method requires Uint8Array parameter; received "${typeof e}".`);
        return e
    }
}
class Cf {
    match(e) {
        return e.length >= 3 && e[0] === 255 && e[1] === 216 && e[2] === 255
    }
    getSize(e) {
        let n = new DataView(e.buffer, e.byteOffset + 4),
            s, r;
        for (; n.byteLength;) {
            if (s = n.getUint16(0, !1), Df(n, s), r = n.getUint8(s + 1), r === 192 || r === 193 || r === 194) return [n.getUint16(s + 7, !1), n.getUint16(s + 5, !1)];
            n = new DataView(e.buffer, n.byteOffset + s + 2)
        }
        throw new TypeError("Invalid JPG, no size found")
    }
    getChannels(e) {
        return 3
    }
}
class ti {
    match(e) {
        return e.length >= 8 && e[0] === 137 && e[1] === 80 && e[2] === 78 && e[3] === 71 && e[4] === 13 && e[5] === 10 && e[6] === 26 && e[7] === 10
    }
    getSize(e) {
        const n = new DataView(e.buffer, e.byteOffset);
        return Te.decodeText(e.slice(12, 16)) === ti.PNG_FRIED_CHUNK_NAME ? [n.getUint32(32, !1), n.getUint32(36, !1)] : [n.getUint32(16, !1), n.getUint32(20, !1)]
    }
    getChannels(e) {
        return 4
    }
}
ti.PNG_FRIED_CHUNK_NAME = "CgBI";
class ts {
    static registerFormat(e, n) {
        this.impls[e] = n
    }
    static getMimeType(e) {
        for (const n in this.impls)
            if (this.impls[n].match(e)) return n;
        return null
    }
    static getSize(e, n) {
        return this.impls[n] ? this.impls[n].getSize(e) : null
    }
    static getChannels(e, n) {
        return this.impls[n] ? this.impls[n].getChannels(e) : null
    }
    static getVRAMByteLength(e, n) {
        if (!this.impls[n]) return null;
        if (this.impls[n].getVRAMByteLength) return this.impls[n].getVRAMByteLength(e);
        let s = 0;
        const r = 4,
            i = this.getSize(e, n);
        if (!i) return null;
        for (; i[0] > 1 || i[1] > 1;) s += i[0] * i[1] * r, i[0] = Math.max(Math.floor(i[0] / 2), 1), i[1] = Math.max(Math.floor(i[1] / 2), 1);
        return s += 1 * 1 * r, s
    }
    static mimeTypeToExtension(e) {
        return e === "image/jpeg" ? "jpg" : e.split("/").pop()
    }
    static extensionToMimeType(e) {
        return e === "jpg" ? "image/jpeg" : e ? `image/${e}` : ""
    }
}
ts.impls = {
    "image/jpeg": new Cf,
    "image/png": new ti
};

function Df(t, e) {
    if (e > t.byteLength) throw new TypeError("Corrupt JPG, exceeded buffer limits");
    if (t.getUint8(e) !== 255) throw new TypeError("Invalid JPG, marker table corrupted");
    return t
}
class rs {
    static basename(e) {
        const n = e.split(/[\\/]/).pop();
        return n.substring(0, n.lastIndexOf("."))
    }
    static extension(e) {
        if (e.startsWith("data:image/")) {
            const n = e.match(/data:(image\/\w+)/)[1];
            return ts.mimeTypeToExtension(n)
        } else {
            if (e.startsWith("data:model/gltf+json")) return "gltf";
            if (e.startsWith("data:model/gltf-binary")) return "glb";
            if (e.startsWith("data:application/")) return "bin"
        }
        return e.split(/[\\/]/).pop().split(/[.]/).pop()
    }
}

function rc(t) {
    return Object.prototype.toString.call(t) === "[object Object]"
}

function Zn(t) {
    if (rc(t) === !1) return !1;
    const e = t.constructor;
    if (e === void 0) return !0;
    const n = e.prototype;
    return !(rc(n) === !1 || Object.prototype.hasOwnProperty.call(n, "isPrototypeOf") === !1)
}
var no, so;
(function (t) {
    t[t.SILENT = 4] = "SILENT", t[t.ERROR = 3] = "ERROR", t[t.WARN = 2] = "WARN", t[t.INFO = 1] = "INFO", t[t.DEBUG = 0] = "DEBUG"
})(so || (so = {}));
class Jt {
    constructor(e) {
        this.verbosity = void 0, this.verbosity = e
    }
    debug(e) {
        this.verbosity <= Jt.Verbosity.DEBUG && console.debug(e)
    }
    info(e) {
        this.verbosity <= Jt.Verbosity.INFO && console.info(e)
    }
    warn(e) {
        this.verbosity <= Jt.Verbosity.WARN && console.warn(e)
    }
    error(e) {
        this.verbosity <= Jt.Verbosity.ERROR && console.error(e)
    }
}
no = Jt;
Jt.Verbosity = so;
Jt.DEFAULT_INSTANCE = new no(no.Verbosity.INFO);

function Gf(t) {
    var e = t[0],
        n = t[1],
        s = t[2],
        r = t[3],
        i = t[4],
        o = t[5],
        c = t[6],
        f = t[7],
        _ = t[8],
        M = t[9],
        A = t[10],
        I = t[11],
        H = t[12],
        V = t[13],
        G = t[14],
        j = t[15],
        T = e * o - n * i,
        Y = e * c - s * i,
        B = e * f - r * i,
        F = n * c - s * o,
        D = n * f - r * o,
        K = s * f - r * c,
        P = _ * V - M * H,
        U = _ * G - A * H,
        X = _ * j - I * H,
        $ = M * G - A * V,
        se = M * j - I * V,
        te = A * j - I * G;
    return T * te - Y * se + B * $ + F * X - D * U + K * P
}

function Vf(t, e, n) {
    var s = e[0],
        r = e[1],
        i = e[2],
        o = e[3],
        c = e[4],
        f = e[5],
        _ = e[6],
        M = e[7],
        A = e[8],
        I = e[9],
        H = e[10],
        V = e[11],
        G = e[12],
        j = e[13],
        T = e[14],
        Y = e[15],
        B = n[0],
        F = n[1],
        D = n[2],
        K = n[3];
    return t[0] = B * s + F * c + D * A + K * G, t[1] = B * r + F * f + D * I + K * j, t[2] = B * i + F * _ + D * H + K * T, t[3] = B * o + F * M + D * V + K * Y, B = n[4], F = n[5], D = n[6], K = n[7], t[4] = B * s + F * c + D * A + K * G, t[5] = B * r + F * f + D * I + K * j, t[6] = B * i + F * _ + D * H + K * T, t[7] = B * o + F * M + D * V + K * Y, B = n[8], F = n[9], D = n[10], K = n[11], t[8] = B * s + F * c + D * A + K * G, t[9] = B * r + F * f + D * I + K * j, t[10] = B * i + F * _ + D * H + K * T, t[11] = B * o + F * M + D * V + K * Y, B = n[12], F = n[13], D = n[14], K = n[15], t[12] = B * s + F * c + D * A + K * G, t[13] = B * r + F * f + D * I + K * j, t[14] = B * i + F * _ + D * H + K * T, t[15] = B * o + F * M + D * V + K * Y, t
}

function zf(t, e) {
    var n = e[0],
        s = e[1],
        r = e[2],
        i = e[4],
        o = e[5],
        c = e[6],
        f = e[8],
        _ = e[9],
        M = e[10];
    return t[0] = Math.hypot(n, s, r), t[1] = Math.hypot(i, o, c), t[2] = Math.hypot(f, _, M), t
}

function jf(t, e) {
    var n = new to(3);
    zf(n, e);
    var s = 1 / n[0],
        r = 1 / n[1],
        i = 1 / n[2],
        o = e[0] * s,
        c = e[1] * r,
        f = e[2] * i,
        _ = e[4] * s,
        M = e[5] * r,
        A = e[6] * i,
        I = e[8] * s,
        H = e[9] * r,
        V = e[10] * i,
        G = o + M + V,
        j = 0;
    return G > 0 ? (j = Math.sqrt(G + 1) * 2, t[3] = .25 * j, t[0] = (A - H) / j, t[1] = (I - f) / j, t[2] = (c - _) / j) : o > M && o > V ? (j = Math.sqrt(1 + o - M - V) * 2, t[3] = (A - H) / j, t[0] = .25 * j, t[1] = (c + _) / j, t[2] = (I + f) / j) : M > V ? (j = Math.sqrt(1 + M - o - V) * 2, t[3] = (I - f) / j, t[0] = (c + _) / j, t[1] = .25 * j, t[2] = (A + H) / j) : (j = Math.sqrt(1 + V - o - M) * 2, t[3] = (c - _) / j, t[0] = (I + f) / j, t[1] = (A + H) / j, t[2] = .25 * j), t
}
class He {
    static identity(e) {
        return e
    }
    static eq(e, n, s = 1e-5) {
        if (e.length !== n.length) return !1;
        for (let r = 0; r < e.length; r++)
            if (Math.abs(e[r] - n[r]) > s) return !1;
        return !0
    }
    static clamp(e, n, s) {
        return e < n ? n : e > s ? s : e
    }
    static decodeNormalizedInt(e, n) {
        switch (n) {
            case 5126:
                return e;
            case 5123:
                return e / 65535;
            case 5121:
                return e / 255;
            case 5122:
                return Math.max(e / 32767, -1);
            case 5120:
                return Math.max(e / 127, -1);
            default:
                throw new Error("Invalid component type.")
        }
    }
    static encodeNormalizedInt(e, n) {
        switch (n) {
            case 5126:
                return e;
            case 5123:
                return Math.round(He.clamp(e, 0, 1) * 65535);
            case 5121:
                return Math.round(He.clamp(e, 0, 1) * 255);
            case 5122:
                return Math.round(He.clamp(e, -1, 1) * 32767);
            case 5120:
                return Math.round(He.clamp(e, -1, 1) * 127);
            default:
                throw new Error("Invalid component type.")
        }
    }
    static decompose(e, n, s, r) {
        let i = Ni([e[0], e[1], e[2]]);
        const o = Ni([e[4], e[5], e[6]]),
            c = Ni([e[8], e[9], e[10]]);
        Gf(e) < 0 && (i = -i), n[0] = e[12], n[1] = e[13], n[2] = e[14];
        const _ = e.slice(),
            M = 1 / i,
            A = 1 / o,
            I = 1 / c;
        _[0] *= M, _[1] *= M, _[2] *= M, _[4] *= A, _[5] *= A, _[6] *= A, _[8] *= I, _[9] *= I, _[10] *= I, jf(s, _), r[0] = i, r[1] = o, r[2] = c
    }
    static compose(e, n, s, r) {
        const i = r,
            o = n[0],
            c = n[1],
            f = n[2],
            _ = n[3],
            M = o + o,
            A = c + c,
            I = f + f,
            H = o * M,
            V = o * A,
            G = o * I,
            j = c * A,
            T = c * I,
            Y = f * I,
            B = _ * M,
            F = _ * A,
            D = _ * I,
            K = s[0],
            P = s[1],
            U = s[2];
        return i[0] = (1 - (j + Y)) * K, i[1] = (V + D) * K, i[2] = (G - F) * K, i[3] = 0, i[4] = (V - D) * P, i[5] = (1 - (H + Y)) * P, i[6] = (T + B) * P, i[7] = 0, i[8] = (G + F) * U, i[9] = (T - B) * U, i[10] = (1 - (H + j)) * U, i[11] = 0, i[12] = e[0], i[13] = e[1], i[14] = e[2], i[15] = 1, i
    }
}

function Hf(t, e) {
    if (!!t != !!e) return !1;
    const n = t.getChild(),
        s = e.getChild();
    return n === s || n.equals(s)
}

function qf(t, e) {
    if (!!t != !!e) return !1;
    const n = t.values(),
        s = e.values();
    if (n.length !== s.length) return !1;
    for (let r = 0; r < n.length; r++) {
        const i = n[r],
            o = s[r];
        if (i.getChild() !== o.getChild() && !i.getChild().equals(o.getChild())) return !1
    }
    return !0
}

function Wf(t, e) {
    if (!!t != !!e) return !1;
    const n = t.keys(),
        s = e.keys();
    if (n.length !== s.length) return !1;
    for (const r of n) {
        const i = t.get(r),
            o = e.get(r);
        if (!!i != !!o) return !1;
        const c = i.getChild(),
            f = o.getChild();
        if (c !== f && !c.equals(f)) return !1
    }
    return !0
}

function Du(t, e) {
    if (t === e) return !0;
    if (!!t != !!e || !t || !e || t.length !== e.length) return !1;
    for (let n = 0; n < t.length; n++)
        if (t[n] !== e[n]) return !1;
    return !0
}

function Gu(t, e) {
    if (t === e) return !0;
    if (!!t != !!e) return !1;
    if (!Zn(t) || !Zn(e)) return t === e;
    const n = t,
        s = e;
    let r = 0,
        i = 0,
        o;
    for (o in n) r++;
    for (o in s) i++;
    if (r !== i) return !1;
    for (o in n) {
        const c = n[o],
            f = s[o];
        if (Hr(c) && Hr(f)) {
            if (!Du(c, f)) return !1
        } else if (Zn(c) && Zn(f)) {
            if (!Gu(c, f)) return !1
        } else if (c !== f) return !1
    }
    return !0
}

function Hr(t) {
    return Array.isArray(t) || ArrayBuffer.isView(t)
}
const ic = "23456789abdegjkmnpqrvwxyzABDEGJKMNPQRVWXYZ",
    Yf = 999,
    $f = 6,
    oc = new Set,
    Xf = function () {
        let e = "";
        for (let n = 0; n < $f; n++) e += ic.charAt(Math.floor(Math.random() * ic.length));
        return e
    },
    Kf = function () {
        for (let e = 0; e < Yf; e++) {
            const n = Xf();
            if (!oc.has(n)) return oc.add(n), n
        }
        return ""
    },
    ac = "https://null.example";
class nn {
    static dirname(e) {
        const n = e.lastIndexOf("/");
        return n === -1 ? "./" : e.substring(0, n + 1)
    }
    static basename(e) {
        return rs.basename(new URL(e, ac).pathname)
    }
    static extension(e) {
        return rs.extension(new URL(e, ac).pathname)
    }
    static resolve(e, n) {
        if (!this.isRelativePath(n)) return n;
        const s = e.split("/"),
            r = n.split("/");
        s.pop();
        for (let i = 0; i < r.length; i++) r[i] !== "." && (r[i] === ".." ? s.pop() : s.push(r[i]));
        return s.join("/")
    }
    static isAbsoluteURL(e) {
        return this.PROTOCOL_REGEXP.test(e)
    }
    static isRelativePath(e) {
        return !/^(?:[a-zA-Z]+:)?\//.test(e)
    }
}
nn.DEFAULT_INIT = {};
nn.PROTOCOL_REGEXP = /^[a-zA-Z]+:\/\//;
const Vn = t => t,
    Jf = new Set;
class Oo extends Io {
    constructor(e, n = "") {
        super(e), this[Me].name = n, this.init(), this.dispatchEvent({
            type: "create"
        })
    }
    getGraph() {
        return this.graph
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            name: "",
            extras: {}
        })
    }
    set(e, n) {
        return Array.isArray(n) && (n = n.slice()), super.set(e, n)
    }
    getName() {
        return this.get("name")
    }
    setName(e) {
        return this.set("name", e)
    }
    getExtras() {
        return this.get("extras")
    }
    setExtras(e) {
        return this.set("extras", e)
    }
    clone() {
        const e = this.constructor;
        return new e(this.graph).copy(this, Vn)
    }
    copy(e, n = Vn) {
        for (const s in this[Me]) {
            const r = this[Me][s];
            if (r instanceof ys) this[Jn].has(s) || r.dispose();
            else if (r instanceof kn || r instanceof Ge)
                for (const i of r.values()) i.dispose();
            else if (r instanceof yn)
                for (const i of r.values()) i.dispose()
        }
        for (const s in e[Me]) {
            const r = this[Me][s],
                i = e[Me][s];
            if (i instanceof ys) this[Jn].has(s) ? r.getChild().copy(n(i.getChild()), n) : this.setRef(s, n(i.getChild()), i.getAttributes());
            else if (i instanceof Ge || i instanceof kn)
                for (const o of i.values()) this.addRef(s, n(o.getChild()), o.getAttributes());
            else if (i instanceof yn)
                for (const o of i.keys()) {
                    const c = i.get(o);
                    this.setRefMap(s, o, n(c.getChild()), c.getAttributes())
                } else Zn(i) ? this[Me][s] = JSON.parse(JSON.stringify(i)) : Array.isArray(i) || i instanceof ArrayBuffer || ArrayBuffer.isView(i) ? this[Me][s] = i.slice() : this[Me][s] = i
        }
        return this
    }
    equals(e, n = Jf) {
        if (this === e) return !0;
        if (this.propertyType !== e.propertyType) return !1;
        for (const s in this[Me]) {
            if (n.has(s)) continue;
            const r = this[Me][s],
                i = e[Me][s];
            if (r instanceof ys || i instanceof ys) {
                if (!Hf(r, i)) return !1
            } else if (r instanceof Ge || i instanceof Ge || r instanceof kn || i instanceof kn) {
                if (!qf(r, i)) return !1
            } else if (r instanceof yn || i instanceof yn) {
                if (!Wf(r, i)) return !1
            } else if (Zn(r) || Zn(i)) {
                if (!Gu(r, i)) return !1
            } else if (Hr(r) || Hr(i)) {
                if (!Du(r, i)) return !1
            } else if (r !== i) return !1
        }
        return !0
    }
    detach() {
        return this.graph.disconnectParents(this, e => e.propertyType !== "Root"), this
    }
    listParents() {
        return this.graph.listParents(this)
    }
}
class At extends Oo {
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            extensions: new yn
        })
    }
    getExtension(e) {
        return this.getRefMap("extensions", e)
    }
    setExtension(e, n) {
        return n && n._validateParent(this), this.setRefMap("extensions", e, n)
    }
    listExtensions() {
        return this.listRefMapValues("extensions")
    }
}
class ye extends At {
    init() {
        this.propertyType = de.ACCESSOR
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            array: null,
            type: ye.Type.SCALAR,
            componentType: ye.ComponentType.FLOAT,
            normalized: !1,
            sparse: !1,
            buffer: null
        })
    }
    static getElementSize(e) {
        switch (e) {
            case ye.Type.SCALAR:
                return 1;
            case ye.Type.VEC2:
                return 2;
            case ye.Type.VEC3:
                return 3;
            case ye.Type.VEC4:
                return 4;
            case ye.Type.MAT2:
                return 4;
            case ye.Type.MAT3:
                return 9;
            case ye.Type.MAT4:
                return 16;
            default:
                throw new Error("Unexpected type: " + e)
        }
    }
    static getComponentSize(e) {
        switch (e) {
            case ye.ComponentType.BYTE:
                return 1;
            case ye.ComponentType.UNSIGNED_BYTE:
                return 1;
            case ye.ComponentType.SHORT:
                return 2;
            case ye.ComponentType.UNSIGNED_SHORT:
                return 2;
            case ye.ComponentType.UNSIGNED_INT:
                return 4;
            case ye.ComponentType.FLOAT:
                return 4;
            default:
                throw new Error("Unexpected component type: " + e)
        }
    }
    getMinNormalized(e) {
        const n = this.getNormalized(),
            s = this.getElementSize(),
            r = this.getComponentType();
        if (this.getMin(e), n)
            for (let i = 0; i < s; i++) e[i] = He.decodeNormalizedInt(e[i], r);
        return e
    }
    getMin(e) {
        const n = this.getArray(),
            s = this.getCount(),
            r = this.getElementSize();
        for (let i = 0; i < r; i++) e[i] = 1 / 0;
        for (let i = 0; i < s * r; i += r)
            for (let o = 0; o < r; o++) {
                const c = n[i + o];
                Number.isFinite(c) && (e[o] = Math.min(e[o], c))
            }
        return e
    }
    getMaxNormalized(e) {
        const n = this.getNormalized(),
            s = this.getElementSize(),
            r = this.getComponentType();
        if (this.getMax(e), n)
            for (let i = 0; i < s; i++) e[i] = He.decodeNormalizedInt(e[i], r);
        return e
    }
    getMax(e) {
        const n = this.get("array"),
            s = this.getCount(),
            r = this.getElementSize();
        for (let i = 0; i < r; i++) e[i] = -1 / 0;
        for (let i = 0; i < s * r; i += r)
            for (let o = 0; o < r; o++) {
                const c = n[i + o];
                Number.isFinite(c) && (e[o] = Math.max(e[o], c))
            }
        return e
    }
    getCount() {
        const e = this.get("array");
        return e ? e.length / this.getElementSize() : 0
    }
    getType() {
        return this.get("type")
    }
    setType(e) {
        return this.set("type", e)
    }
    getElementSize() {
        return ye.getElementSize(this.get("type"))
    }
    getComponentSize() {
        return this.get("array").BYTES_PER_ELEMENT
    }
    getComponentType() {
        return this.get("componentType")
    }
    getNormalized() {
        return this.get("normalized")
    }
    setNormalized(e) {
        return this.set("normalized", e)
    }
    getScalar(e) {
        const n = this.getElementSize(),
            s = this.getComponentType(),
            r = this.getArray();
        return this.getNormalized() ? He.decodeNormalizedInt(r[e * n], s) : r[e * n]
    }
    setScalar(e, n) {
        const s = this.getElementSize(),
            r = this.getComponentType(),
            i = this.getArray();
        return this.getNormalized() ? i[e * s] = He.encodeNormalizedInt(n, r) : i[e * s] = n, this
    }
    getElement(e, n) {
        const s = this.getNormalized(),
            r = this.getElementSize(),
            i = this.getComponentType(),
            o = this.getArray();
        for (let c = 0; c < r; c++) s ? n[c] = He.decodeNormalizedInt(o[e * r + c], i) : n[c] = o[e * r + c];
        return n
    }
    setElement(e, n) {
        const s = this.getNormalized(),
            r = this.getElementSize(),
            i = this.getComponentType(),
            o = this.getArray();
        for (let c = 0; c < r; c++) s ? o[e * r + c] = He.encodeNormalizedInt(n[c], i) : o[e * r + c] = n[c];
        return this
    }
    getSparse() {
        return this.get("sparse")
    }
    setSparse(e) {
        return this.set("sparse", e)
    }
    getBuffer() {
        return this.getRef("buffer")
    }
    setBuffer(e) {
        return this.setRef("buffer", e)
    }
    getArray() {
        return this.get("array")
    }
    setArray(e) {
        return this.set("componentType", e ? Zf(e) : ye.ComponentType.FLOAT), this.set("array", e), this
    }
    getByteLength() {
        const e = this.get("array");
        return e ? e.byteLength : 0
    }
}
ye.Type = {
    SCALAR: "SCALAR",
    VEC2: "VEC2",
    VEC3: "VEC3",
    VEC4: "VEC4",
    MAT2: "MAT2",
    MAT3: "MAT3",
    MAT4: "MAT4"
};
ye.ComponentType = {
    BYTE: 5120,
    UNSIGNED_BYTE: 5121,
    SHORT: 5122,
    UNSIGNED_SHORT: 5123,
    UNSIGNED_INT: 5125,
    FLOAT: 5126
};

function Zf(t) {
    switch (t.constructor) {
        case Float32Array:
            return ye.ComponentType.FLOAT;
        case Uint32Array:
            return ye.ComponentType.UNSIGNED_INT;
        case Uint16Array:
            return ye.ComponentType.UNSIGNED_SHORT;
        case Uint8Array:
            return ye.ComponentType.UNSIGNED_BYTE;
        case Int16Array:
            return ye.ComponentType.SHORT;
        case Int8Array:
            return ye.ComponentType.BYTE;
        default:
            throw new Error("Unknown accessor componentType.")
    }
}
class Vu extends At {
    init() {
        this.propertyType = de.ANIMATION
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            channels: new Ge,
            samplers: new Ge
        })
    }
    addChannel(e) {
        return this.addRef("channels", e)
    }
    removeChannel(e) {
        return this.removeRef("channels", e)
    }
    listChannels() {
        return this.listRefs("channels")
    }
    addSampler(e) {
        return this.addRef("samplers", e)
    }
    removeSampler(e) {
        return this.removeRef("samplers", e)
    }
    listSamplers() {
        return this.listRefs("samplers")
    }
}
class zu extends At {
    init() {
        this.propertyType = de.ANIMATION_CHANNEL
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            targetPath: null,
            targetNode: null,
            sampler: null
        })
    }
    getTargetPath() {
        return this.get("targetPath")
    }
    setTargetPath(e) {
        return this.set("targetPath", e)
    }
    getTargetNode() {
        return this.getRef("targetNode")
    }
    setTargetNode(e) {
        return this.setRef("targetNode", e)
    }
    getSampler() {
        return this.getRef("sampler")
    }
    setSampler(e) {
        return this.setRef("sampler", e)
    }
}
zu.TargetPath = {
    TRANSLATION: "translation",
    ROTATION: "rotation",
    SCALE: "scale",
    WEIGHTS: "weights"
};
class lr extends At {
    init() {
        this.propertyType = de.ANIMATION_SAMPLER
    }
    getDefaultAttributes() {
        return Object.assign(super.getDefaults(), {
            interpolation: lr.Interpolation.LINEAR,
            input: null,
            output: null
        })
    }
    getInterpolation() {
        return this.get("interpolation")
    }
    setInterpolation(e) {
        return this.set("interpolation", e)
    }
    getInput() {
        return this.getRef("input")
    }
    setInput(e) {
        return this.setRef("input", e, {
            usage: zt.OTHER
        })
    }
    getOutput() {
        return this.getRef("output")
    }
    setOutput(e) {
        return this.setRef("output", e, {
            usage: zt.OTHER
        })
    }
}
lr.Interpolation = {
    LINEAR: "LINEAR",
    STEP: "STEP",
    CUBICSPLINE: "CUBICSPLINE"
};
class ju extends At {
    init() {
        this.propertyType = de.BUFFER
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            uri: ""
        })
    }
    getURI() {
        return this.get("uri")
    }
    setURI(e) {
        return this.set("uri", e)
    }
}
class ls extends At {
    init() {
        this.propertyType = de.CAMERA
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            type: ls.Type.PERSPECTIVE,
            znear: .1,
            zfar: 100,
            aspectRatio: null,
            yfov: Math.PI * 2 * 50 / 360,
            xmag: 1,
            ymag: 1
        })
    }
    getType() {
        return this.get("type")
    }
    setType(e) {
        return this.set("type", e)
    }
    getZNear() {
        return this.get("znear")
    }
    setZNear(e) {
        return this.set("znear", e)
    }
    getZFar() {
        return this.get("zfar")
    }
    setZFar(e) {
        return this.set("zfar", e)
    }
    getAspectRatio() {
        return this.get("aspectRatio")
    }
    setAspectRatio(e) {
        return this.set("aspectRatio", e)
    }
    getYFov() {
        return this.get("yfov")
    }
    setYFov(e) {
        return this.set("yfov", e)
    }
    getXMag() {
        return this.get("xmag")
    }
    setXMag(e) {
        return this.set("xmag", e)
    }
    getYMag() {
        return this.get("ymag")
    }
    setYMag(e) {
        return this.set("ymag", e)
    }
}
ls.Type = {
    PERSPECTIVE: "perspective",
    ORTHOGRAPHIC: "orthographic"
};
class Qf extends Oo {
    _validateParent(e) {
        if (!this.parentTypes.includes(e.propertyType)) throw new Error(`Parent "${e.propertyType}" invalid for child "${this.propertyType}".`)
    }
}
Qf.EXTENSION_NAME = void 0;
class sn extends At {
    init() {
        this.propertyType = de.TEXTURE_INFO
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            texCoord: 0,
            magFilter: null,
            minFilter: null,
            wrapS: sn.WrapMode.REPEAT,
            wrapT: sn.WrapMode.REPEAT
        })
    }
    getTexCoord() {
        return this.get("texCoord")
    }
    setTexCoord(e) {
        return this.set("texCoord", e)
    }
    getMagFilter() {
        return this.get("magFilter")
    }
    setMagFilter(e) {
        return this.set("magFilter", e)
    }
    getMinFilter() {
        return this.get("minFilter")
    }
    setMinFilter(e) {
        return this.set("minFilter", e)
    }
    getWrapS() {
        return this.get("wrapS")
    }
    setWrapS(e) {
        return this.set("wrapS", e)
    }
    getWrapT() {
        return this.get("wrapT")
    }
    setWrapT(e) {
        return this.set("wrapT", e)
    }
}
sn.WrapMode = {
    CLAMP_TO_EDGE: 33071,
    MIRRORED_REPEAT: 33648,
    REPEAT: 10497
};
sn.MagFilter = {
    NEAREST: 9728,
    LINEAR: 9729
};
sn.MinFilter = {
    NEAREST: 9728,
    LINEAR: 9729,
    NEAREST_MIPMAP_NEAREST: 9984,
    LINEAR_MIPMAP_NEAREST: 9985,
    NEAREST_MIPMAP_LINEAR: 9986,
    LINEAR_MIPMAP_LINEAR: 9987
};
const {
    R: Er,
    G: Ar,
    B: Tr,
    A: eh
} = eo;
class is extends At {
    init() {
        this.propertyType = de.MATERIAL
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            alphaMode: is.AlphaMode.OPAQUE,
            alphaCutoff: .5,
            doubleSided: !1,
            baseColorFactor: [1, 1, 1, 1],
            baseColorTexture: null,
            baseColorTextureInfo: new sn(this.graph, "baseColorTextureInfo"),
            emissiveFactor: [0, 0, 0],
            emissiveTexture: null,
            emissiveTextureInfo: new sn(this.graph, "emissiveTextureInfo"),
            normalScale: 1,
            normalTexture: null,
            normalTextureInfo: new sn(this.graph, "normalTextureInfo"),
            occlusionStrength: 1,
            occlusionTexture: null,
            occlusionTextureInfo: new sn(this.graph, "occlusionTextureInfo"),
            roughnessFactor: 1,
            metallicFactor: 1,
            metallicRoughnessTexture: null,
            metallicRoughnessTextureInfo: new sn(this.graph, "metallicRoughnessTextureInfo")
        })
    }
    getDoubleSided() {
        return this.get("doubleSided")
    }
    setDoubleSided(e) {
        return this.set("doubleSided", e)
    }
    getAlpha() {
        return this.get("baseColorFactor")[3]
    }
    setAlpha(e) {
        const n = this.get("baseColorFactor").slice();
        return n[3] = e, this.set("baseColorFactor", n)
    }
    getAlphaMode() {
        return this.get("alphaMode")
    }
    setAlphaMode(e) {
        return this.set("alphaMode", e)
    }
    getAlphaCutoff() {
        return this.get("alphaCutoff")
    }
    setAlphaCutoff(e) {
        return this.set("alphaCutoff", e)
    }
    getBaseColorFactor() {
        return this.get("baseColorFactor")
    }
    setBaseColorFactor(e) {
        return this.set("baseColorFactor", e)
    }
    getBaseColorTexture() {
        return this.getRef("baseColorTexture")
    }
    getBaseColorTextureInfo() {
        return this.getRef("baseColorTexture") ? this.getRef("baseColorTextureInfo") : null
    }
    setBaseColorTexture(e) {
        return this.setRef("baseColorTexture", e, {
            channels: Er | Ar | Tr | eh,
            isColor: !0
        })
    }
    getEmissiveFactor() {
        return this.get("emissiveFactor")
    }
    setEmissiveFactor(e) {
        return this.set("emissiveFactor", e)
    }
    getEmissiveTexture() {
        return this.getRef("emissiveTexture")
    }
    getEmissiveTextureInfo() {
        return this.getRef("emissiveTexture") ? this.getRef("emissiveTextureInfo") : null
    }
    setEmissiveTexture(e) {
        return this.setRef("emissiveTexture", e, {
            channels: Er | Ar | Tr,
            isColor: !0
        })
    }
    getNormalScale() {
        return this.get("normalScale")
    }
    setNormalScale(e) {
        return this.set("normalScale", e)
    }
    getNormalTexture() {
        return this.getRef("normalTexture")
    }
    getNormalTextureInfo() {
        return this.getRef("normalTexture") ? this.getRef("normalTextureInfo") : null
    }
    setNormalTexture(e) {
        return this.setRef("normalTexture", e, {
            channels: Er | Ar | Tr
        })
    }
    getOcclusionStrength() {
        return this.get("occlusionStrength")
    }
    setOcclusionStrength(e) {
        return this.set("occlusionStrength", e)
    }
    getOcclusionTexture() {
        return this.getRef("occlusionTexture")
    }
    getOcclusionTextureInfo() {
        return this.getRef("occlusionTexture") ? this.getRef("occlusionTextureInfo") : null
    }
    setOcclusionTexture(e) {
        return this.setRef("occlusionTexture", e, {
            channels: Er
        })
    }
    getRoughnessFactor() {
        return this.get("roughnessFactor")
    }
    setRoughnessFactor(e) {
        return this.set("roughnessFactor", e)
    }
    getMetallicFactor() {
        return this.get("metallicFactor")
    }
    setMetallicFactor(e) {
        return this.set("metallicFactor", e)
    }
    getMetallicRoughnessTexture() {
        return this.getRef("metallicRoughnessTexture")
    }
    getMetallicRoughnessTextureInfo() {
        return this.getRef("metallicRoughnessTexture") ? this.getRef("metallicRoughnessTextureInfo") : null
    }
    setMetallicRoughnessTexture(e) {
        return this.setRef("metallicRoughnessTexture", e, {
            channels: Ar | Tr
        })
    }
}
is.AlphaMode = {
    OPAQUE: "OPAQUE",
    MASK: "MASK",
    BLEND: "BLEND"
};
class Hu extends At {
    init() {
        this.propertyType = de.MESH
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            weights: [],
            primitives: new Ge
        })
    }
    addPrimitive(e) {
        return this.addRef("primitives", e)
    }
    removePrimitive(e) {
        return this.removeRef("primitives", e)
    }
    listPrimitives() {
        return this.listRefs("primitives")
    }
    getWeights() {
        return this.get("weights")
    }
    setWeights(e) {
        return this.set("weights", e)
    }
}
class qu extends At {
    init() {
        this.propertyType = de.NODE
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            translation: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
            weights: [],
            camera: null,
            mesh: null,
            skin: null,
            children: new Ge
        })
    }
    copy(e, n = Vn) {
        if (n === Vn) throw new Error("Node cannot be copied.");
        return super.copy(e, n)
    }
    getTranslation() {
        return this.get("translation")
    }
    getRotation() {
        return this.get("rotation")
    }
    getScale() {
        return this.get("scale")
    }
    setTranslation(e) {
        return this.set("translation", e)
    }
    setRotation(e) {
        return this.set("rotation", e)
    }
    setScale(e) {
        return this.set("scale", e)
    }
    getMatrix() {
        return He.compose(this.get("translation"), this.get("rotation"), this.get("scale"), [])
    }
    setMatrix(e) {
        const n = this.get("translation").slice(),
            s = this.get("rotation").slice(),
            r = this.get("scale").slice();
        return He.decompose(e, n, s, r), this.set("translation", n).set("rotation", s).set("scale", r)
    }
    getWorldTranslation() {
        const e = [0, 0, 0];
        return He.decompose(this.getWorldMatrix(), e, [0, 0, 0, 1], [1, 1, 1]), e
    }
    getWorldRotation() {
        const e = [0, 0, 0, 1];
        return He.decompose(this.getWorldMatrix(), [0, 0, 0], e, [1, 1, 1]), e
    }
    getWorldScale() {
        const e = [1, 1, 1];
        return He.decompose(this.getWorldMatrix(), [0, 0, 0], [0, 0, 0, 1], e), e
    }
    getWorldMatrix() {
        const e = [];
        for (let r = this; r != null; r = r.getParentNode()) e.push(r);
        let n;
        const s = e.pop().getMatrix();
        for (; n = e.pop();) Vf(s, s, n.getMatrix());
        return s
    }
    addChild(e) {
        const n = e.getParentNode();
        n && n.removeChild(e);
        for (const s of e.listParents()) s.propertyType === de.SCENE && s.removeChild(e);
        return this.addRef("children", e)
    }
    removeChild(e) {
        return this.removeRef("children", e)
    }
    listChildren() {
        return this.listRefs("children")
    }
    getParentNode() {
        for (const e of this.listParents())
            if (e.propertyType === de.NODE) return e;
        return null
    }
    getMesh() {
        return this.getRef("mesh")
    }
    setMesh(e) {
        return this.setRef("mesh", e)
    }
    getCamera() {
        return this.getRef("camera")
    }
    setCamera(e) {
        return this.setRef("camera", e)
    }
    getSkin() {
        return this.getRef("skin")
    }
    setSkin(e) {
        return this.setRef("skin", e)
    }
    getWeights() {
        return this.get("weights")
    }
    setWeights(e) {
        return this.set("weights", e)
    }
    traverse(e) {
        e(this);
        for (const n of this.listChildren()) n.traverse(e);
        return this
    }
}
class ni extends At {
    init() {
        this.propertyType = de.PRIMITIVE
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            mode: ni.Mode.TRIANGLES,
            material: null,
            indices: null,
            attributes: new yn,
            targets: new Ge
        })
    }
    getIndices() {
        return this.getRef("indices")
    }
    setIndices(e) {
        return this.setRef("indices", e, {
            usage: zt.ELEMENT_ARRAY_BUFFER
        })
    }
    getAttribute(e) {
        return this.getRefMap("attributes", e)
    }
    setAttribute(e, n) {
        return this.setRefMap("attributes", e, n, {
            usage: zt.ARRAY_BUFFER
        })
    }
    listAttributes() {
        return this.listRefMapValues("attributes")
    }
    listSemantics() {
        return this.listRefMapKeys("attributes")
    }
    getMaterial() {
        return this.getRef("material")
    }
    setMaterial(e) {
        return this.setRef("material", e)
    }
    getMode() {
        return this.get("mode")
    }
    setMode(e) {
        return this.set("mode", e)
    }
    listTargets() {
        return this.listRefs("targets")
    }
    addTarget(e) {
        return this.addRef("targets", e)
    }
    removeTarget(e) {
        return this.removeRef("targets", e)
    }
}
ni.Mode = {
    POINTS: 0,
    LINES: 1,
    LINE_LOOP: 2,
    LINE_STRIP: 3,
    TRIANGLES: 4,
    TRIANGLE_STRIP: 5,
    TRIANGLE_FAN: 6
};
class th extends Oo {
    init() {
        this.propertyType = de.PRIMITIVE_TARGET
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            attributes: new yn
        })
    }
    getAttribute(e) {
        return this.getRefMap("attributes", e)
    }
    setAttribute(e, n) {
        return this.setRefMap("attributes", e, n, {
            usage: zt.ARRAY_BUFFER
        })
    }
    listAttributes() {
        return this.listRefMapValues("attributes")
    }
    listSemantics() {
        return this.listRefMapKeys("attributes")
    }
}

function xt() {
    return xt = Object.assign ? Object.assign.bind() : function (t) {
        for (var e = 1; e < arguments.length; e++) {
            var n = arguments[e];
            for (var s in n) ({}).hasOwnProperty.call(n, s) && (t[s] = n[s])
        }
        return t
    }, xt.apply(null, arguments)
}
class Wu extends At {
    init() {
        this.propertyType = de.SCENE
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            children: new Ge
        })
    }
    copy(e, n = Vn) {
        if (n === Vn) throw new Error("Scene cannot be copied.");
        return super.copy(e, n)
    }
    addChild(e) {
        const n = e.getParentNode();
        return n && n.removeChild(e), this.addRef("children", e)
    }
    removeChild(e) {
        return this.removeRef("children", e)
    }
    listChildren() {
        return this.listRefs("children")
    }
    traverse(e) {
        for (const n of this.listChildren()) n.traverse(e);
        return this
    }
}
class Yu extends At {
    init() {
        this.propertyType = de.SKIN
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            skeleton: null,
            inverseBindMatrices: null,
            joints: new Ge
        })
    }
    getSkeleton() {
        return this.getRef("skeleton")
    }
    setSkeleton(e) {
        return this.setRef("skeleton", e)
    }
    getInverseBindMatrices() {
        return this.getRef("inverseBindMatrices")
    }
    setInverseBindMatrices(e) {
        return this.setRef("inverseBindMatrices", e, {
            usage: zt.INVERSE_BIND_MATRICES
        })
    }
    addJoint(e) {
        return this.addRef("joints", e)
    }
    removeJoint(e) {
        return this.removeRef("joints", e)
    }
    listJoints() {
        return this.listRefs("joints")
    }
}
class $u extends At {
    init() {
        this.propertyType = de.TEXTURE
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            image: null,
            mimeType: "",
            uri: ""
        })
    }
    getMimeType() {
        return this.get("mimeType") || ts.extensionToMimeType(rs.extension(this.get("uri")))
    }
    setMimeType(e) {
        return this.set("mimeType", e)
    }
    getURI() {
        return this.get("uri")
    }
    setURI(e) {
        this.set("uri", e);
        const n = ts.extensionToMimeType(rs.extension(e));
        return n && this.set("mimeType", n), this
    }
    getImage() {
        return this.get("image")
    }
    setImage(e) {
        return this.set("image", Te.assertView(e))
    }
    getSize() {
        const e = this.get("image");
        return e ? ts.getSize(e, this.getMimeType()) : null
    }
}
class nh extends At {
    init() {
        this.propertyType = de.ROOT
    }
    getDefaults() {
        return Object.assign(super.getDefaults(), {
            asset: {
                generator: `glTF-Transform ${Cu}`,
                version: "2.0"
            },
            defaultScene: null,
            accessors: new Ge,
            animations: new Ge,
            buffers: new Ge,
            cameras: new Ge,
            materials: new Ge,
            meshes: new Ge,
            nodes: new Ge,
            scenes: new Ge,
            skins: new Ge,
            textures: new Ge
        })
    }
    constructor(e) {
        super(e), this._extensions = new Set, e.addEventListener("node:create", n => {
            this._addChildOfRoot(n.target)
        })
    }
    clone() {
        throw new Error("Root cannot be cloned.")
    }
    copy(e, n = Vn) {
        if (n === Vn) throw new Error("Root cannot be copied.");
        this.set("asset", xt({}, e.get("asset"))), this.setName(e.getName()), this.setExtras(xt({}, e.getExtras())), this.setDefaultScene(e.getDefaultScene() ? n(e.getDefaultScene()) : null);
        for (const s of e.listRefMapKeys("extensions")) {
            const r = e.getExtension(s);
            this.setExtension(s, n(r))
        }
        return this
    }
    _addChildOfRoot(e) {
        return e instanceof Wu ? this.addRef("scenes", e) : e instanceof qu ? this.addRef("nodes", e) : e instanceof ls ? this.addRef("cameras", e) : e instanceof Yu ? this.addRef("skins", e) : e instanceof Hu ? this.addRef("meshes", e) : e instanceof is ? this.addRef("materials", e) : e instanceof $u ? this.addRef("textures", e) : e instanceof Vu ? this.addRef("animations", e) : e instanceof ye ? this.addRef("accessors", e) : e instanceof ju && this.addRef("buffers", e), this
    }
    getAsset() {
        return this.get("asset")
    }
    listExtensionsUsed() {
        return Array.from(this._extensions)
    }
    listExtensionsRequired() {
        return this.listExtensionsUsed().filter(e => e.isRequired())
    }
    _enableExtension(e) {
        return this._extensions.add(e), this
    }
    _disableExtension(e) {
        return this._extensions.delete(e), this
    }
    listScenes() {
        return this.listRefs("scenes")
    }
    setDefaultScene(e) {
        return this.setRef("defaultScene", e)
    }
    getDefaultScene() {
        return this.getRef("defaultScene")
    }
    listNodes() {
        return this.listRefs("nodes")
    }
    listCameras() {
        return this.listRefs("cameras")
    }
    listSkins() {
        return this.listRefs("skins")
    }
    listMeshes() {
        return this.listRefs("meshes")
    }
    listMaterials() {
        return this.listRefs("materials")
    }
    listTextures() {
        return this.listRefs("textures")
    }
    listAnimations() {
        return this.listRefs("animations")
    }
    listAccessors() {
        return this.listRefs("accessors")
    }
    listBuffers() {
        return this.listRefs("buffers")
    }
}
class nr {
    static fromGraph(e) {
        return nr._GRAPH_DOCUMENTS.get(e) || null
    }
    constructor() {
        this._graph = new Uf, this._root = new nh(this._graph), this._logger = Jt.DEFAULT_INSTANCE, nr._GRAPH_DOCUMENTS.set(this._graph, this)
    }
    getRoot() {
        return this._root
    }
    getGraph() {
        return this._graph
    }
    getLogger() {
        return this._logger
    }
    setLogger(e) {
        return this._logger = e, this
    }
    clone() {
        throw new Error("Use 'cloneDocument(source)' from '@gltf-transform/functions'.")
    }
    merge(e) {
        throw new Error("Use 'mergeDocuments(target, source)' from '@gltf-transform/functions'.")
    }
    async transform(...e) {
        const n = e.map(s => s.name);
        for (const s of e) await s(this, {
            stack: n
        });
        return this
    }
    createExtension(e) {
        const n = e.EXTENSION_NAME;
        return this.getRoot().listExtensionsUsed().find(r => r.extensionName === n) || new e(this)
    }
    createScene(e = "") {
        return new Wu(this._graph, e)
    }
    createNode(e = "") {
        return new qu(this._graph, e)
    }
    createCamera(e = "") {
        return new ls(this._graph, e)
    }
    createSkin(e = "") {
        return new Yu(this._graph, e)
    }
    createMesh(e = "") {
        return new Hu(this._graph, e)
    }
    createPrimitive() {
        return new ni(this._graph)
    }
    createPrimitiveTarget(e = "") {
        return new th(this._graph, e)
    }
    createMaterial(e = "") {
        return new is(this._graph, e)
    }
    createTexture(e = "") {
        return new $u(this._graph, e)
    }
    createAnimation(e = "") {
        return new Vu(this._graph, e)
    }
    createAnimationChannel(e = "") {
        return new zu(this._graph, e)
    }
    createAnimationSampler(e = "") {
        return new lr(this._graph, e)
    }
    createAccessor(e = "", n = null) {
        return n || (n = this.getRoot().listBuffers()[0]), new ye(this._graph, e).setBuffer(n)
    }
    createBuffer(e = "") {
        return new ju(this._graph, e)
    }
}
nr._GRAPH_DOCUMENTS = new WeakMap;
class sh {
    constructor(e) {
        this.jsonDoc = void 0, this.buffers = [], this.bufferViews = [], this.bufferViewBuffers = [], this.accessors = [], this.textures = [], this.textureInfos = new Map, this.materials = [], this.meshes = [], this.cameras = [], this.nodes = [], this.skins = [], this.animations = [], this.scenes = [], this.jsonDoc = e
    }
    setTextureInfo(e, n) {
        this.textureInfos.set(e, n), n.texCoord !== void 0 && e.setTexCoord(n.texCoord), n.extras !== void 0 && e.setExtras(n.extras);
        const s = this.jsonDoc.json.textures[n.index];
        if (s.sampler === void 0) return;
        const r = this.jsonDoc.json.samplers[s.sampler];
        r.magFilter !== void 0 && e.setMagFilter(r.magFilter), r.minFilter !== void 0 && e.setMinFilter(r.minFilter), r.wrapS !== void 0 && e.setWrapS(r.wrapS), r.wrapT !== void 0 && e.setWrapT(r.wrapT)
    }
}
const cc = {
    logger: Jt.DEFAULT_INSTANCE,
    extensions: [],
    dependencies: {}
},
    rh = new Set([de.BUFFER, de.TEXTURE, de.MATERIAL, de.MESH, de.PRIMITIVE, de.NODE, de.SCENE]);
class ih {
    static read(e, n = cc) {
        const s = xt({}, cc, n),
            {
                json: r
            } = e,
            i = new nr().setLogger(s.logger);
        this.validate(e, s);
        const o = new sh(e),
            c = r.asset,
            f = i.getRoot().getAsset();
        c.copyright && (f.copyright = c.copyright), c.extras && (f.extras = c.extras), r.extras !== void 0 && i.getRoot().setExtras(xt({}, r.extras));
        const _ = r.extensionsUsed || [],
            M = r.extensionsRequired || [];
        s.extensions.sort((P, U) => P.EXTENSION_NAME > U.EXTENSION_NAME ? 1 : -1);
        for (const P of s.extensions)
            if (_.includes(P.EXTENSION_NAME)) {
                const U = i.createExtension(P).setRequired(M.includes(P.EXTENSION_NAME)),
                    X = U.prereadTypes.filter($ => !rh.has($));
                X.length && s.logger.warn(`Preread hooks for some types (${X.join()}), requested by extension ${U.extensionName}, are unsupported. Please file an issue or a PR.`);
                for (const $ of U.readDependencies) U.install($, s.dependencies[$])
            } const A = r.buffers || [];
        i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.BUFFER)).forEach(P => P.preread(o, de.BUFFER)), o.buffers = A.map(P => {
            const U = i.createBuffer(P.name);
            return P.extras && U.setExtras(P.extras), P.uri && P.uri.indexOf("__") !== 0 && U.setURI(P.uri), U
        });
        const I = r.bufferViews || [];
        o.bufferViewBuffers = I.map((P, U) => {
            if (!o.bufferViews[U]) {
                const X = e.json.buffers[P.buffer],
                    $ = X.uri ? e.resources[X.uri] : e.resources[zr],
                    se = P.byteOffset || 0;
                o.bufferViews[U] = Te.toView($, se, P.byteLength)
            }
            return o.buffers[P.buffer]
        });
        const H = r.accessors || [];
        o.accessors = H.map(P => {
            const U = o.bufferViewBuffers[P.bufferView],
                X = i.createAccessor(P.name, U).setType(P.type);
            return P.extras && X.setExtras(P.extras), P.normalized !== void 0 && X.setNormalized(P.normalized), P.bufferView === void 0 || X.setArray(Lr(P, o)), X
        });
        const V = r.images || [],
            G = r.textures || [];
        i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.TEXTURE)).forEach(P => P.preread(o, de.TEXTURE)), o.textures = V.map(P => {
            const U = i.createTexture(P.name);
            if (P.extras && U.setExtras(P.extras), P.bufferView !== void 0) {
                const X = r.bufferViews[P.bufferView],
                    $ = e.json.buffers[X.buffer],
                    se = $.uri ? e.resources[$.uri] : e.resources[zr],
                    te = X.byteOffset || 0,
                    ie = X.byteLength,
                    _e = se.slice(te, te + ie);
                U.setImage(_e)
            } else P.uri !== void 0 && (U.setImage(e.resources[P.uri]), P.uri.indexOf("__") !== 0 && U.setURI(P.uri));
            if (P.mimeType !== void 0) U.setMimeType(P.mimeType);
            else if (P.uri) {
                const X = rs.extension(P.uri);
                U.setMimeType(ts.extensionToMimeType(X))
            }
            return U
        }), i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.MATERIAL)).forEach(P => P.preread(o, de.MATERIAL));
        const j = r.materials || [];
        o.materials = j.map(P => {
            const U = i.createMaterial(P.name);
            P.extras && U.setExtras(P.extras), P.alphaMode !== void 0 && U.setAlphaMode(P.alphaMode), P.alphaCutoff !== void 0 && U.setAlphaCutoff(P.alphaCutoff), P.doubleSided !== void 0 && U.setDoubleSided(P.doubleSided);
            const X = P.pbrMetallicRoughness || {};
            if (X.baseColorFactor !== void 0 && U.setBaseColorFactor(X.baseColorFactor), P.emissiveFactor !== void 0 && U.setEmissiveFactor(P.emissiveFactor), X.metallicFactor !== void 0 && U.setMetallicFactor(X.metallicFactor), X.roughnessFactor !== void 0 && U.setRoughnessFactor(X.roughnessFactor), X.baseColorTexture !== void 0) {
                const $ = X.baseColorTexture,
                    se = o.textures[G[$.index].source];
                U.setBaseColorTexture(se), o.setTextureInfo(U.getBaseColorTextureInfo(), $)
            }
            if (P.emissiveTexture !== void 0) {
                const $ = P.emissiveTexture,
                    se = o.textures[G[$.index].source];
                U.setEmissiveTexture(se), o.setTextureInfo(U.getEmissiveTextureInfo(), $)
            }
            if (P.normalTexture !== void 0) {
                const $ = P.normalTexture,
                    se = o.textures[G[$.index].source];
                U.setNormalTexture(se), o.setTextureInfo(U.getNormalTextureInfo(), $), P.normalTexture.scale !== void 0 && U.setNormalScale(P.normalTexture.scale)
            }
            if (P.occlusionTexture !== void 0) {
                const $ = P.occlusionTexture,
                    se = o.textures[G[$.index].source];
                U.setOcclusionTexture(se), o.setTextureInfo(U.getOcclusionTextureInfo(), $), P.occlusionTexture.strength !== void 0 && U.setOcclusionStrength(P.occlusionTexture.strength)
            }
            if (X.metallicRoughnessTexture !== void 0) {
                const $ = X.metallicRoughnessTexture,
                    se = o.textures[G[$.index].source];
                U.setMetallicRoughnessTexture(se), o.setTextureInfo(U.getMetallicRoughnessTextureInfo(), $)
            }
            return U
        }), i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.MESH)).forEach(P => P.preread(o, de.MESH));
        const T = r.meshes || [];
        i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.PRIMITIVE)).forEach(P => P.preread(o, de.PRIMITIVE)), o.meshes = T.map(P => {
            const U = i.createMesh(P.name);
            return P.extras && U.setExtras(P.extras), P.weights !== void 0 && U.setWeights(P.weights), (P.primitives || []).forEach($ => {
                const se = i.createPrimitive();
                $.extras && se.setExtras($.extras), $.material !== void 0 && se.setMaterial(o.materials[$.material]), $.mode !== void 0 && se.setMode($.mode);
                for (const [_e, ee] of Object.entries($.attributes || {})) se.setAttribute(_e, o.accessors[ee]);
                $.indices !== void 0 && se.setIndices(o.accessors[$.indices]);
                const te = P.extras && P.extras.targetNames || [];
                ($.targets || []).forEach((_e, ee) => {
                    const ne = te[ee] || ee.toString(),
                        ce = i.createPrimitiveTarget(ne);
                    for (const [Ie, Fe] of Object.entries(_e)) ce.setAttribute(Ie, o.accessors[Fe]);
                    se.addTarget(ce)
                }), U.addPrimitive(se)
            }), U
        });
        const Y = r.cameras || [];
        o.cameras = Y.map(P => {
            const U = i.createCamera(P.name).setType(P.type);
            if (P.extras && U.setExtras(P.extras), P.type === ls.Type.PERSPECTIVE) {
                const X = P.perspective;
                U.setYFov(X.yfov), U.setZNear(X.znear), X.zfar !== void 0 && U.setZFar(X.zfar), X.aspectRatio !== void 0 && U.setAspectRatio(X.aspectRatio)
            } else {
                const X = P.orthographic;
                U.setZNear(X.znear).setZFar(X.zfar).setXMag(X.xmag).setYMag(X.ymag)
            }
            return U
        });
        const B = r.nodes || [];
        i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.NODE)).forEach(P => P.preread(o, de.NODE)), o.nodes = B.map(P => {
            const U = i.createNode(P.name);
            if (P.extras && U.setExtras(P.extras), P.translation !== void 0 && U.setTranslation(P.translation), P.rotation !== void 0 && U.setRotation(P.rotation), P.scale !== void 0 && U.setScale(P.scale), P.matrix !== void 0) {
                const X = [0, 0, 0],
                    $ = [0, 0, 0, 1],
                    se = [1, 1, 1];
                He.decompose(P.matrix, X, $, se), U.setTranslation(X), U.setRotation($), U.setScale(se)
            }
            return P.weights !== void 0 && U.setWeights(P.weights), U
        });
        const F = r.skins || [];
        o.skins = F.map(P => {
            const U = i.createSkin(P.name);
            P.extras && U.setExtras(P.extras), P.inverseBindMatrices !== void 0 && U.setInverseBindMatrices(o.accessors[P.inverseBindMatrices]), P.skeleton !== void 0 && U.setSkeleton(o.nodes[P.skeleton]);
            for (const X of P.joints) U.addJoint(o.nodes[X]);
            return U
        }), B.map((P, U) => {
            const X = o.nodes[U];
            (P.children || []).forEach(se => X.addChild(o.nodes[se])), P.mesh !== void 0 && X.setMesh(o.meshes[P.mesh]), P.camera !== void 0 && X.setCamera(o.cameras[P.camera]), P.skin !== void 0 && X.setSkin(o.skins[P.skin])
        });
        const D = r.animations || [];
        o.animations = D.map(P => {
            const U = i.createAnimation(P.name);
            P.extras && U.setExtras(P.extras);
            const $ = (P.samplers || []).map(te => {
                const ie = i.createAnimationSampler().setInput(o.accessors[te.input]).setOutput(o.accessors[te.output]).setInterpolation(te.interpolation || lr.Interpolation.LINEAR);
                return te.extras && ie.setExtras(te.extras), U.addSampler(ie), ie
            });
            return (P.channels || []).forEach(te => {
                const ie = i.createAnimationChannel().setSampler($[te.sampler]).setTargetPath(te.target.path);
                te.target.node !== void 0 && ie.setTargetNode(o.nodes[te.target.node]), te.extras && ie.setExtras(te.extras), U.addChannel(ie)
            }), U
        });
        const K = r.scenes || [];
        return i.getRoot().listExtensionsUsed().filter(P => P.prereadTypes.includes(de.SCENE)).forEach(P => P.preread(o, de.SCENE)), o.scenes = K.map(P => {
            const U = i.createScene(P.name);
            return P.extras && U.setExtras(P.extras), (P.nodes || []).map($ => o.nodes[$]).forEach($ => U.addChild($)), U
        }), r.scene !== void 0 && i.getRoot().setDefaultScene(o.scenes[r.scene]), i.getRoot().listExtensionsUsed().forEach(P => P.read(o)), H.forEach((P, U) => {
            const X = o.accessors[U],
                $ = !!P.sparse,
                se = !P.bufferView && !X.getArray();
            ($ || se) && X.setSparse(!0).setArray(ah(P, o))
        }), i
    }
    static validate(e, n) {
        const s = e.json;
        if (s.asset.version !== "2.0") throw new Error(`Unsupported glTF version, "${s.asset.version}".`);
        if (s.extensionsRequired) {
            for (const r of s.extensionsRequired)
                if (!n.extensions.find(i => i.EXTENSION_NAME === r)) throw new Error(`Missing required extension, "${r}".`)
        }
        if (s.extensionsUsed)
            for (const r of s.extensionsUsed) n.extensions.find(i => i.EXTENSION_NAME === r) || n.logger.warn(`Missing optional extension, "${r}".`)
    }
}

function oh(t, e) {
    const n = e.jsonDoc,
        s = e.bufferViews[t.bufferView],
        r = n.json.bufferViews[t.bufferView],
        i = ei[t.componentType],
        o = ye.getElementSize(t.type),
        c = i.BYTES_PER_ELEMENT,
        f = t.byteOffset || 0,
        _ = new i(t.count * o),
        M = new DataView(s.buffer, s.byteOffset, s.byteLength),
        A = r.byteStride;
    for (let I = 0; I < t.count; I++)
        for (let H = 0; H < o; H++) {
            const V = f + I * A + H * c;
            let G;
            switch (t.componentType) {
                case ye.ComponentType.FLOAT:
                    G = M.getFloat32(V, !0);
                    break;
                case ye.ComponentType.UNSIGNED_INT:
                    G = M.getUint32(V, !0);
                    break;
                case ye.ComponentType.UNSIGNED_SHORT:
                    G = M.getUint16(V, !0);
                    break;
                case ye.ComponentType.UNSIGNED_BYTE:
                    G = M.getUint8(V);
                    break;
                case ye.ComponentType.SHORT:
                    G = M.getInt16(V, !0);
                    break;
                case ye.ComponentType.BYTE:
                    G = M.getInt8(V);
                    break;
                default:
                    throw new Error(`Unexpected componentType "${t.componentType}".`)
            }
            _[I * o + H] = G
        }
    return _
}

function Lr(t, e) {
    const n = e.jsonDoc,
        s = e.bufferViews[t.bufferView],
        r = n.json.bufferViews[t.bufferView],
        i = ei[t.componentType],
        o = ye.getElementSize(t.type),
        c = i.BYTES_PER_ELEMENT,
        f = o * c;
    if (r.byteStride !== void 0 && r.byteStride !== f) return oh(t, e);
    const _ = s.byteOffset + (t.byteOffset || 0),
        M = t.count * o * c;
    return new i(s.buffer.slice(_, _ + M))
}

function ah(t, e) {
    const n = ei[t.componentType],
        s = ye.getElementSize(t.type);
    let r;
    t.bufferView !== void 0 ? r = Lr(t, e) : r = new n(t.count * s);
    const i = t.sparse;
    if (!i) return r;
    const o = i.count,
        c = xt({}, t, i.indices, {
            count: o,
            type: "SCALAR"
        }),
        f = xt({}, t, i.values, {
            count: o
        }),
        _ = Lr(c, e),
        M = Lr(f, e);
    for (let A = 0; A < c.count; A++)
        for (let I = 0; I < s; I++) r[_[A] * s + I] = M[A * s + I];
    return r
}
var sr;
(function (t) {
    t[t.ARRAY_BUFFER = 34962] = "ARRAY_BUFFER", t[t.ELEMENT_ARRAY_BUFFER = 34963] = "ELEMENT_ARRAY_BUFFER"
})(sr || (sr = {}));
class ns {
    constructor(e, n, s) {
        this._doc = void 0, this.jsonDoc = void 0, this.options = void 0, this.accessorIndexMap = new Map, this.animationIndexMap = new Map, this.bufferIndexMap = new Map, this.cameraIndexMap = new Map, this.skinIndexMap = new Map, this.materialIndexMap = new Map, this.meshIndexMap = new Map, this.nodeIndexMap = new Map, this.imageIndexMap = new Map, this.textureDefIndexMap = new Map, this.textureInfoDefMap = new Map, this.samplerDefIndexMap = new Map, this.sceneIndexMap = new Map, this.imageBufferViews = [], this.otherBufferViews = new Map, this.otherBufferViewsIndexMap = new Map, this.extensionData = {}, this.bufferURIGenerator = void 0, this.imageURIGenerator = void 0, this.logger = void 0, this._accessorUsageMap = new Map, this.accessorUsageGroupedByParent = new Set(["ARRAY_BUFFER"]), this.accessorParents = new Map, this._doc = e, this.jsonDoc = n, this.options = s;
        const r = e.getRoot(),
            i = r.listBuffers().length,
            o = r.listTextures().length;
        this.bufferURIGenerator = new uc(i > 1, () => s.basename || "buffer"), this.imageURIGenerator = new uc(o > 1, c => ch(e, c) || s.basename || "texture"), this.logger = e.getLogger()
    }
    createTextureInfoDef(e, n) {
        const s = {
            magFilter: n.getMagFilter() || void 0,
            minFilter: n.getMinFilter() || void 0,
            wrapS: n.getWrapS(),
            wrapT: n.getWrapT()
        },
            r = JSON.stringify(s);
        this.samplerDefIndexMap.has(r) || (this.samplerDefIndexMap.set(r, this.jsonDoc.json.samplers.length), this.jsonDoc.json.samplers.push(s));
        const i = {
            source: this.imageIndexMap.get(e),
            sampler: this.samplerDefIndexMap.get(r)
        },
            o = JSON.stringify(i);
        this.textureDefIndexMap.has(o) || (this.textureDefIndexMap.set(o, this.jsonDoc.json.textures.length), this.jsonDoc.json.textures.push(i));
        const c = {
            index: this.textureDefIndexMap.get(o)
        };
        return n.getTexCoord() !== 0 && (c.texCoord = n.getTexCoord()), Object.keys(n.getExtras()).length > 0 && (c.extras = n.getExtras()), this.textureInfoDefMap.set(n, c), c
    }
    createPropertyDef(e) {
        const n = {};
        return e.getName() && (n.name = e.getName()), Object.keys(e.getExtras()).length > 0 && (n.extras = e.getExtras()), n
    }
    createAccessorDef(e) {
        const n = this.createPropertyDef(e);
        return n.type = e.getType(), n.componentType = e.getComponentType(), n.count = e.getCount(), this._doc.getGraph().listParentEdges(e).some(r => r.getName() === "attributes" && r.getAttributes().key === "POSITION" || r.getName() === "input") && (n.max = e.getMax([]).map(Math.fround), n.min = e.getMin([]).map(Math.fround)), e.getNormalized() && (n.normalized = e.getNormalized()), n
    }
    createImageData(e, n, s) {
        if (this.options.format === Tn.GLB) this.imageBufferViews.push(n), e.bufferView = this.jsonDoc.json.bufferViews.length, this.jsonDoc.json.bufferViews.push({
            buffer: 0,
            byteOffset: -1,
            byteLength: n.byteLength
        });
        else {
            const r = ts.mimeTypeToExtension(s.getMimeType());
            e.uri = this.imageURIGenerator.createURI(s, r), this.assignResourceURI(e.uri, n, !1)
        }
    }
    assignResourceURI(e, n, s) {
        const r = this.jsonDoc.resources;
        if (!(e in r)) {
            r[e] = n;
            return
        }
        if (n === r[e]) {
            this.logger.warn(`Duplicate resource URI, "${e}".`);
            return
        }
        const i = `Resource URI "${e}" already assigned to different data.`;
        if (!s) {
            this.logger.warn(i);
            return
        }
        throw new Error(i)
    }
    getAccessorUsage(e) {
        const n = this._accessorUsageMap.get(e);
        if (n) return n;
        if (e.getSparse()) return zt.SPARSE;
        for (const s of this._doc.getGraph().listParentEdges(e)) {
            const {
                usage: r
            } = s.getAttributes();
            if (r) return r;
            s.getParent().propertyType !== de.ROOT && this.logger.warn(`Missing attribute ".usage" on edge, "${s.getName()}".`)
        }
        return zt.OTHER
    }
    addAccessorToUsageGroup(e, n) {
        const s = this._accessorUsageMap.get(e);
        if (s && s !== n) throw new Error(`Accessor with usage "${s}" cannot be reused as "${n}".`);
        return this._accessorUsageMap.set(e, n), this
    }
}
ns.BufferViewTarget = sr;
ns.BufferViewUsage = zt;
ns.USAGE_TO_TARGET = {
    [zt.ARRAY_BUFFER]: sr.ARRAY_BUFFER,
    [zt.ELEMENT_ARRAY_BUFFER]: sr.ELEMENT_ARRAY_BUFFER
};
class uc {
    constructor(e, n) {
        this.multiple = void 0, this.basename = void 0, this.counter = {}, this.multiple = e, this.basename = n
    }
    createURI(e, n) {
        if (e.getURI()) return e.getURI();
        if (this.multiple) {
            const s = this.basename(e);
            return this.counter[s] = this.counter[s] || 1, `${s}_${this.counter[s]++}.${n}`
        } else return `${this.basename(e)}.${n}`
    }
}

function ch(t, e) {
    const n = t.getGraph().listParentEdges(e).find(s => s.getParent() !== t.getRoot());
    return n ? n.getName().replace(/texture$/i, "") : ""
}
const {
    BufferViewUsage: Sr
} = ns, {
    UNSIGNED_INT: uh,
    UNSIGNED_SHORT: lh,
    UNSIGNED_BYTE: fh
} = ye.ComponentType, hh = new Set([de.ACCESSOR, de.BUFFER, de.MATERIAL, de.MESH]);
class dh {
    static write(e, n) {
        const s = e.getGraph(),
            r = e.getRoot(),
            i = {
                asset: xt({
                    generator: `glTF-Transform ${Cu}`
                }, r.getAsset()),
                extras: xt({}, r.getExtras())
            },
            o = {
                json: i,
                resources: {}
            },
            c = new ns(e, o, n),
            f = n.logger || Jt.DEFAULT_INSTANCE,
            _ = new Set(n.extensions.map(T => T.EXTENSION_NAME)),
            M = e.getRoot().listExtensionsUsed().filter(T => _.has(T.extensionName)).sort((T, Y) => T.extensionName > Y.extensionName ? 1 : -1),
            A = e.getRoot().listExtensionsRequired().filter(T => _.has(T.extensionName)).sort((T, Y) => T.extensionName > Y.extensionName ? 1 : -1);
        M.length < e.getRoot().listExtensionsUsed().length && f.warn("Some extensions were not registered for I/O, and will not be written.");
        for (const T of M) {
            const Y = T.prewriteTypes.filter(B => !hh.has(B));
            Y.length && f.warn(`Prewrite hooks for some types (${Y.join()}), requested by extension ${T.extensionName}, are unsupported. Please file an issue or a PR.`);
            for (const B of T.writeDependencies) T.install(B, n.dependencies[B])
        }

        function I(T, Y, B, F) {
            const D = [];
            let K = 0;
            for (const X of T) {
                const $ = c.createAccessorDef(X);
                $.bufferView = i.bufferViews.length;
                const se = X.getArray(),
                    te = Te.pad(Te.toView(se));
                $.byteOffset = K, K += te.byteLength, D.push(te), c.accessorIndexMap.set(X, i.accessors.length), i.accessors.push($)
            }
            const P = Te.concat(D),
                U = {
                    buffer: Y,
                    byteOffset: B,
                    byteLength: P.byteLength
                };
            return F && (U.target = F), i.bufferViews.push(U), {
                buffers: D,
                byteLength: K
            }
        }

        function H(T, Y, B) {
            const F = T[0].getCount();
            let D = 0;
            for (const $ of T) {
                const se = c.createAccessorDef($);
                se.bufferView = i.bufferViews.length, se.byteOffset = D;
                const te = $.getElementSize(),
                    ie = $.getComponentSize();
                D += Te.padNumber(te * ie), c.accessorIndexMap.set($, i.accessors.length), i.accessors.push(se)
            }
            const K = F * D,
                P = new ArrayBuffer(K),
                U = new DataView(P);
            for (let $ = 0; $ < F; $++) {
                let se = 0;
                for (const te of T) {
                    const ie = te.getElementSize(),
                        _e = te.getComponentSize(),
                        ee = te.getComponentType(),
                        ne = te.getArray();
                    for (let ce = 0; ce < ie; ce++) {
                        const Ie = $ * D + se + ce * _e,
                            Fe = ne[$ * ie + ce];
                        switch (ee) {
                            case ye.ComponentType.FLOAT:
                                U.setFloat32(Ie, Fe, !0);
                                break;
                            case ye.ComponentType.BYTE:
                                U.setInt8(Ie, Fe);
                                break;
                            case ye.ComponentType.SHORT:
                                U.setInt16(Ie, Fe, !0);
                                break;
                            case ye.ComponentType.UNSIGNED_BYTE:
                                U.setUint8(Ie, Fe);
                                break;
                            case ye.ComponentType.UNSIGNED_SHORT:
                                U.setUint16(Ie, Fe, !0);
                                break;
                            case ye.ComponentType.UNSIGNED_INT:
                                U.setUint32(Ie, Fe, !0);
                                break;
                            default:
                                throw new Error("Unexpected component type: " + ee)
                        }
                    }
                    se += Te.padNumber(ie * _e)
                }
            }
            const X = {
                buffer: Y,
                byteOffset: B,
                byteLength: K,
                byteStride: D,
                target: ns.BufferViewTarget.ARRAY_BUFFER
            };
            return i.bufferViews.push(X), {
                byteLength: K,
                buffers: [new Uint8Array(P)]
            }
        }

        function V(T, Y, B) {
            const F = [];
            let D = 0;
            const K = new Map;
            let P = -1 / 0,
                U = !1;
            for (const ee of T) {
                const ne = c.createAccessorDef(ee);
                i.accessors.push(ne), c.accessorIndexMap.set(ee, i.accessors.length - 1);
                const ce = [],
                    Ie = [],
                    Fe = [],
                    Oe = new Array(ee.getElementSize()).fill(0);
                for (let Ke = 0, Mt = ee.getCount(); Ke < Mt; Ke++)
                    if (ee.getElement(Ke, Fe), !He.eq(Fe, Oe, 0)) {
                        P = Math.max(Ke, P), ce.push(Ke);
                        for (let ut = 0; ut < Fe.length; ut++) Ie.push(Fe[ut])
                    } const yt = ce.length,
                        rt = {
                            accessorDef: ne,
                            count: yt
                        };
                if (K.set(ee, rt), yt === 0) continue;
                yt > ee.getCount() / 2 && (U = !0);
                const Lt = ei[ee.getComponentType()];
                rt.indices = ce, rt.values = new Lt(Ie)
            }
            if (!Number.isFinite(P)) return {
                buffers: F,
                byteLength: D
            };
            U && f.warn("Some sparse accessors have >50% non-zero elements, which may increase file size.");
            const X = P < 255 ? Uint8Array : P < 65535 ? Uint16Array : Uint32Array,
                $ = P < 255 ? fh : P < 65535 ? lh : uh,
                se = {
                    buffer: Y,
                    byteOffset: B + D,
                    byteLength: 0
                };
            for (const ee of T) {
                const ne = K.get(ee);
                if (ne.count === 0) continue;
                ne.indicesByteOffset = se.byteLength;
                const ce = Te.pad(Te.toView(new X(ne.indices)));
                F.push(ce), D += ce.byteLength, se.byteLength += ce.byteLength
            }
            i.bufferViews.push(se);
            const te = i.bufferViews.length - 1,
                ie = {
                    buffer: Y,
                    byteOffset: B + D,
                    byteLength: 0
                };
            for (const ee of T) {
                const ne = K.get(ee);
                if (ne.count === 0) continue;
                ne.valuesByteOffset = ie.byteLength;
                const ce = Te.pad(Te.toView(ne.values));
                F.push(ce), D += ce.byteLength, ie.byteLength += ce.byteLength
            }
            i.bufferViews.push(ie);
            const _e = i.bufferViews.length - 1;
            for (const ee of T) {
                const ne = K.get(ee);
                ne.count !== 0 && (ne.accessorDef.sparse = {
                    count: ne.count,
                    indices: {
                        bufferView: te,
                        byteOffset: ne.indicesByteOffset,
                        componentType: $
                    },
                    values: {
                        bufferView: _e,
                        byteOffset: ne.valuesByteOffset
                    }
                })
            }
            return {
                buffers: F,
                byteLength: D
            }
        }
        if (i.accessors = [], i.bufferViews = [], i.samplers = [], i.textures = [], i.images = r.listTextures().map((T, Y) => {
            const B = c.createPropertyDef(T);
            T.getMimeType() && (B.mimeType = T.getMimeType());
            const F = T.getImage();
            return F && c.createImageData(B, F, T), c.imageIndexMap.set(T, Y), B
        }), M.filter(T => T.prewriteTypes.includes(de.ACCESSOR)).forEach(T => T.prewrite(c, de.ACCESSOR)), r.listAccessors().forEach(T => {
            const Y = c.accessorUsageGroupedByParent,
                B = c.accessorParents;
            if (c.accessorIndexMap.has(T)) return;
            const F = c.getAccessorUsage(T);
            if (c.addAccessorToUsageGroup(T, F), Y.has(F)) {
                const D = s.listParents(T).find(K => K.propertyType !== de.ROOT);
                B.set(T, D)
            }
        }), M.filter(T => T.prewriteTypes.includes(de.BUFFER)).forEach(T => T.prewrite(c, de.BUFFER)), (r.listAccessors().length > 0 || c.otherBufferViews.size > 0 || r.listTextures().length > 0 && n.format === Tn.GLB) && r.listBuffers().length === 0) throw new Error("Buffer required for Document resources, but none was found.");
        i.buffers = [], r.listBuffers().forEach((T, Y) => {
            const B = c.createPropertyDef(T),
                F = c.accessorUsageGroupedByParent,
                D = T.listParents().filter(ie => ie instanceof ye),
                K = new Set(D.map(ie => c.accessorParents.get(ie))),
                P = new Map(Array.from(K).map((ie, _e) => [ie, _e])),
                U = {};
            for (const ie of D) {
                var X;
                if (c.accessorIndexMap.has(ie)) continue;
                const _e = c.getAccessorUsage(ie);
                let ee = _e;
                if (F.has(_e)) {
                    const ne = c.accessorParents.get(ie);
                    ee += `:${P.get(ne)}`
                }
                U[X = ee] || (U[X] = {
                    usage: _e,
                    accessors: []
                }), U[ee].accessors.push(ie)
            }
            const $ = [],
                se = i.buffers.length;
            let te = 0;
            for (const {
                usage: ie,
                accessors: _e
            } of Object.values(U))
                if (ie === Sr.ARRAY_BUFFER && n.vertexLayout === jr.INTERLEAVED) {
                    const ee = H(_e, se, te);
                    te += ee.byteLength;
                    for (const ne of ee.buffers) $.push(ne)
                } else if (ie === Sr.ARRAY_BUFFER)
                    for (const ee of _e) {
                        const ne = H([ee], se, te);
                        te += ne.byteLength;
                        for (const ce of ne.buffers) $.push(ce)
                    } else if (ie === Sr.SPARSE) {
                        const ee = V(_e, se, te);
                        te += ee.byteLength;
                        for (const ne of ee.buffers) $.push(ne)
                    } else if (ie === Sr.ELEMENT_ARRAY_BUFFER) {
                        const ee = ns.BufferViewTarget.ELEMENT_ARRAY_BUFFER,
                            ne = I(_e, se, te, ee);
                        te += ne.byteLength;
                        for (const ce of ne.buffers) $.push(ce)
                    } else {
                    const ee = I(_e, se, te);
                    te += ee.byteLength;
                    for (const ne of ee.buffers) $.push(ne)
                }
            if (c.imageBufferViews.length && Y === 0) {
                for (let ie = 0; ie < c.imageBufferViews.length; ie++)
                    if (i.bufferViews[i.images[ie].bufferView].byteOffset = te, te += c.imageBufferViews[ie].byteLength, $.push(c.imageBufferViews[ie]), te % 8) {
                        const _e = 8 - te % 8;
                        te += _e, $.push(new Uint8Array(_e))
                    }
            }
            if (c.otherBufferViews.has(T))
                for (const ie of c.otherBufferViews.get(T)) i.bufferViews.push({
                    buffer: se,
                    byteOffset: te,
                    byteLength: ie.byteLength
                }), c.otherBufferViewsIndexMap.set(ie, i.bufferViews.length - 1), te += ie.byteLength, $.push(ie);
            if (te) {
                let ie;
                n.format === Tn.GLB ? ie = zr : (ie = c.bufferURIGenerator.createURI(T, "bin"), B.uri = ie), B.byteLength = te, c.assignResourceURI(ie, Te.concat($), !0)
            }
            i.buffers.push(B), c.bufferIndexMap.set(T, Y)
        }), r.listAccessors().find(T => !T.getBuffer()) && f.warn("Skipped writing one or more Accessors: no Buffer assigned."), M.filter(T => T.prewriteTypes.includes(de.MATERIAL)).forEach(T => T.prewrite(c, de.MATERIAL)), i.materials = r.listMaterials().map((T, Y) => {
            const B = c.createPropertyDef(T);
            if (T.getAlphaMode() !== is.AlphaMode.OPAQUE && (B.alphaMode = T.getAlphaMode()), T.getAlphaMode() === is.AlphaMode.MASK && (B.alphaCutoff = T.getAlphaCutoff()), T.getDoubleSided() && (B.doubleSided = !0), B.pbrMetallicRoughness = {}, He.eq(T.getBaseColorFactor(), [1, 1, 1, 1]) || (B.pbrMetallicRoughness.baseColorFactor = T.getBaseColorFactor()), He.eq(T.getEmissiveFactor(), [0, 0, 0]) || (B.emissiveFactor = T.getEmissiveFactor()), T.getRoughnessFactor() !== 1 && (B.pbrMetallicRoughness.roughnessFactor = T.getRoughnessFactor()), T.getMetallicFactor() !== 1 && (B.pbrMetallicRoughness.metallicFactor = T.getMetallicFactor()), T.getBaseColorTexture()) {
                const F = T.getBaseColorTexture(),
                    D = T.getBaseColorTextureInfo();
                B.pbrMetallicRoughness.baseColorTexture = c.createTextureInfoDef(F, D)
            }
            if (T.getEmissiveTexture()) {
                const F = T.getEmissiveTexture(),
                    D = T.getEmissiveTextureInfo();
                B.emissiveTexture = c.createTextureInfoDef(F, D)
            }
            if (T.getNormalTexture()) {
                const F = T.getNormalTexture(),
                    D = T.getNormalTextureInfo(),
                    K = c.createTextureInfoDef(F, D);
                T.getNormalScale() !== 1 && (K.scale = T.getNormalScale()), B.normalTexture = K
            }
            if (T.getOcclusionTexture()) {
                const F = T.getOcclusionTexture(),
                    D = T.getOcclusionTextureInfo(),
                    K = c.createTextureInfoDef(F, D);
                T.getOcclusionStrength() !== 1 && (K.strength = T.getOcclusionStrength()), B.occlusionTexture = K
            }
            if (T.getMetallicRoughnessTexture()) {
                const F = T.getMetallicRoughnessTexture(),
                    D = T.getMetallicRoughnessTextureInfo();
                B.pbrMetallicRoughness.metallicRoughnessTexture = c.createTextureInfoDef(F, D)
            }
            return c.materialIndexMap.set(T, Y), B
        }), M.filter(T => T.prewriteTypes.includes(de.MESH)).forEach(T => T.prewrite(c, de.MESH)), i.meshes = r.listMeshes().map((T, Y) => {
            const B = c.createPropertyDef(T);
            let F = null;
            return B.primitives = T.listPrimitives().map(D => {
                const K = {
                    attributes: {}
                };
                K.mode = D.getMode();
                const P = D.getMaterial();
                P && (K.material = c.materialIndexMap.get(P)), Object.keys(D.getExtras()).length && (K.extras = D.getExtras());
                const U = D.getIndices();
                U && (K.indices = c.accessorIndexMap.get(U));
                for (const X of D.listSemantics()) K.attributes[X] = c.accessorIndexMap.get(D.getAttribute(X));
                for (const X of D.listTargets()) {
                    const $ = {};
                    for (const se of X.listSemantics()) $[se] = c.accessorIndexMap.get(X.getAttribute(se));
                    K.targets = K.targets || [], K.targets.push($)
                }
                return D.listTargets().length && !F && (F = D.listTargets().map(X => X.getName())), K
            }), T.getWeights().length && (B.weights = T.getWeights()), F && (B.extras = B.extras || {}, B.extras.targetNames = F), c.meshIndexMap.set(T, Y), B
        }), i.cameras = r.listCameras().map((T, Y) => {
            const B = c.createPropertyDef(T);
            if (B.type = T.getType(), B.type === ls.Type.PERSPECTIVE) {
                B.perspective = {
                    znear: T.getZNear(),
                    zfar: T.getZFar(),
                    yfov: T.getYFov()
                };
                const F = T.getAspectRatio();
                F !== null && (B.perspective.aspectRatio = F)
            } else B.orthographic = {
                znear: T.getZNear(),
                zfar: T.getZFar(),
                xmag: T.getXMag(),
                ymag: T.getYMag()
            };
            return c.cameraIndexMap.set(T, Y), B
        }), i.nodes = r.listNodes().map((T, Y) => {
            const B = c.createPropertyDef(T);
            return He.eq(T.getTranslation(), [0, 0, 0]) || (B.translation = T.getTranslation()), He.eq(T.getRotation(), [0, 0, 0, 1]) || (B.rotation = T.getRotation()), He.eq(T.getScale(), [1, 1, 1]) || (B.scale = T.getScale()), T.getWeights().length && (B.weights = T.getWeights()), c.nodeIndexMap.set(T, Y), B
        }), i.skins = r.listSkins().map((T, Y) => {
            const B = c.createPropertyDef(T),
                F = T.getInverseBindMatrices();
            F && (B.inverseBindMatrices = c.accessorIndexMap.get(F));
            const D = T.getSkeleton();
            return D && (B.skeleton = c.nodeIndexMap.get(D)), B.joints = T.listJoints().map(K => c.nodeIndexMap.get(K)), c.skinIndexMap.set(T, Y), B
        }), r.listNodes().forEach((T, Y) => {
            const B = i.nodes[Y],
                F = T.getMesh();
            F && (B.mesh = c.meshIndexMap.get(F));
            const D = T.getCamera();
            D && (B.camera = c.cameraIndexMap.get(D));
            const K = T.getSkin();
            K && (B.skin = c.skinIndexMap.get(K)), T.listChildren().length > 0 && (B.children = T.listChildren().map(P => c.nodeIndexMap.get(P)))
        }), i.animations = r.listAnimations().map((T, Y) => {
            const B = c.createPropertyDef(T),
                F = new Map;
            return B.samplers = T.listSamplers().map((D, K) => {
                const P = c.createPropertyDef(D);
                return P.input = c.accessorIndexMap.get(D.getInput()), P.output = c.accessorIndexMap.get(D.getOutput()), P.interpolation = D.getInterpolation(), F.set(D, K), P
            }), B.channels = T.listChannels().map(D => {
                const K = c.createPropertyDef(D);
                return K.sampler = F.get(D.getSampler()), K.target = {
                    node: c.nodeIndexMap.get(D.getTargetNode()),
                    path: D.getTargetPath()
                }, K
            }), c.animationIndexMap.set(T, Y), B
        }), i.scenes = r.listScenes().map((T, Y) => {
            const B = c.createPropertyDef(T);
            return B.nodes = T.listChildren().map(F => c.nodeIndexMap.get(F)), c.sceneIndexMap.set(T, Y), B
        });
        const j = r.getDefaultScene();
        return j && (i.scene = r.listScenes().indexOf(j)), i.extensionsUsed = M.map(T => T.extensionName), i.extensionsRequired = A.map(T => T.extensionName), M.forEach(T => T.write(c)), ph(i), o
    }
}

function ph(t) {
    const e = [];
    for (const n in t) {
        const s = t[n];
        (Array.isArray(s) && s.length === 0 || s === null || s === "" || s && typeof s == "object" && Object.keys(s).length === 0) && e.push(n)
    }
    for (const n of e) delete t[n]
}
var qr;
(function (t) {
    t[t.JSON = 1313821514] = "JSON", t[t.BIN = 5130562] = "BIN"
})(qr || (qr = {}));
class gh {
    constructor() {
        this._logger = Jt.DEFAULT_INSTANCE, this._extensions = new Set, this._dependencies = {}, this._vertexLayout = jr.INTERLEAVED, this.lastReadBytes = 0, this.lastWriteBytes = 0
    }
    setLogger(e) {
        return this._logger = e, this
    }
    registerExtensions(e) {
        for (const n of e) this._extensions.add(n), n.register();
        return this
    }
    registerDependencies(e) {
        return Object.assign(this._dependencies, e), this
    }
    setVertexLayout(e) {
        return this._vertexLayout = e, this
    }
    async read(e) {
        return await this.readJSON(await this.readAsJSON(e))
    }
    async readAsJSON(e) {
        const n = await this.readURI(e, "view");
        this.lastReadBytes = n.byteLength;
        const s = lc(n) ? this._binaryToJSON(n) : {
            json: JSON.parse(Te.decodeText(n)),
            resources: {}
        };
        return await this._readResourcesExternal(s, this.dirname(e)), this._readResourcesInternal(s), s
    }
    async readJSON(e) {
        return e = this._copyJSON(e), this._readResourcesInternal(e), ih.read(e, {
            extensions: Array.from(this._extensions),
            dependencies: this._dependencies,
            logger: this._logger
        })
    }
    async binaryToJSON(e) {
        const n = this._binaryToJSON(Te.assertView(e));
        this._readResourcesInternal(n);
        const s = n.json;
        if (s.buffers && s.buffers.some(r => mh(n, r))) throw new Error("Cannot resolve external buffers with binaryToJSON().");
        if (s.images && s.images.some(r => yh(n, r))) throw new Error("Cannot resolve external images with binaryToJSON().");
        return n
    }
    async readBinary(e) {
        return this.readJSON(await this.binaryToJSON(Te.assertView(e)))
    }
    async writeJSON(e, n = {}) {
        if (n.format === Tn.GLB && e.getRoot().listBuffers().length > 1) throw new Error("GLB must have 0–1 buffers.");
        return dh.write(e, {
            format: n.format || Tn.GLTF,
            basename: n.basename || "",
            logger: this._logger,
            vertexLayout: this._vertexLayout,
            dependencies: xt({}, this._dependencies),
            extensions: Array.from(this._extensions)
        })
    }
    async writeBinary(e) {
        const {
            json: n,
            resources: s
        } = await this.writeJSON(e, {
            format: Tn.GLB
        }), r = new Uint32Array([1179937895, 2, 12]), i = JSON.stringify(n), o = Te.pad(Te.encodeText(i), 32), c = Te.toView(new Uint32Array([o.byteLength, 1313821514])), f = Te.concat([c, o]);
        r[r.length - 1] += f.byteLength;
        const _ = Object.values(s)[0];
        if (!_ || !_.byteLength) return Te.concat([Te.toView(r), f]);
        const M = Te.pad(_, 0),
            A = Te.toView(new Uint32Array([M.byteLength, 5130562])),
            I = Te.concat([A, M]);
        return r[r.length - 1] += I.byteLength, Te.concat([Te.toView(r), f, I])
    }
    async _readResourcesExternal(e, n) {
        var s = this;
        const r = e.json.images || [],
            i = e.json.buffers || [],
            o = [...r, ...i].map(async function (c) {
                const f = c.uri;
                if (!f || f.match(/data:/)) return Promise.resolve();
                e.resources[f] = await s.readURI(s.resolve(n, f), "view"), s.lastReadBytes += e.resources[f].byteLength
            });
        await Promise.all(o)
    }
    _readResourcesInternal(e) {
        function n(i) {
            if (i.uri) {
                if (i.uri in e.resources) {
                    Te.assertView(e.resources[i.uri]);
                    return
                }
                if (i.uri.match(/data:/)) {
                    const o = `__${Kf()}.${rs.extension(i.uri)}`;
                    e.resources[o] = Te.createBufferFromDataURI(i.uri), i.uri = o
                }
            }
        } (e.json.images || []).forEach(i => {
            if (i.bufferView === void 0 && i.uri === void 0) throw new Error("Missing resource URI or buffer view.");
            n(i)
        }), (e.json.buffers || []).forEach(n)
    }
    _copyJSON(e) {
        const {
            images: n,
            buffers: s
        } = e.json;
        return e = {
            json: xt({}, e.json),
            resources: xt({}, e.resources)
        }, n && (e.json.images = n.map(r => xt({}, r))), s && (e.json.buffers = s.map(r => xt({}, r))), e
    }
    _binaryToJSON(e) {
        if (!lc(e)) throw new Error("Invalid glTF 2.0 binary.");
        const n = new Uint32Array(e.buffer, e.byteOffset + 12, 2);
        if (n[1] !== qr.JSON) throw new Error("Missing required GLB JSON chunk.");
        const s = 20,
            r = n[0],
            i = Te.decodeText(Te.toView(e, s, r)),
            o = JSON.parse(i),
            c = s + r;
        if (e.byteLength <= c) return {
            json: o,
            resources: {}
        };
        const f = new Uint32Array(e.buffer, e.byteOffset + c, 2);
        if (f[1] !== qr.BIN) return {
            json: o,
            resources: {}
        };
        const _ = f[0],
            M = Te.toView(e, c + 8, _);
        return {
            json: o,
            resources: {
                [zr]: M
            }
        }
    }
}

function mh(t, e) {
    return e.uri !== void 0 && !(e.uri in t.resources)
}

function yh(t, e) {
    return e.uri !== void 0 && !(e.uri in t.resources) && e.bufferView === void 0
}

function lc(t) {
    if (t.byteLength < 3 * Uint32Array.BYTES_PER_ELEMENT) return !1;
    const e = new Uint32Array(t.buffer, t.byteOffset, 3);
    return e[0] === 1179937895 && e[1] === 2
}
class _h extends gh {
    constructor(e = null, n = nn.DEFAULT_INIT) {
        super(), this._fetch = void 0, this._fetchConfig = void 0, this._init = void 0, this._fetchEnabled = !1, this._fetch = e, this._fetchConfig = n, this._init = this.init()
    }
    async init() {
        return this._init ? this._init : Promise.all([sc(() => import("./__vite-browser-external-BIHI7g3E.js"), []), sc(() => import("./__vite-browser-external-BIHI7g3E.js"), [])]).then(([e, n]) => {
            this._fs = e.promises, this._path = n
        })
    }
    setAllowNetwork(e) {
        if (e && !this._fetch) throw new Error("NodeIO requires a Fetch API implementation for HTTP requests.");
        return this._fetchEnabled = e, this
    }
    async readURI(e, n) {
        if (await this.init(), nn.isAbsoluteURL(e)) {
            if (!this._fetchEnabled || !this._fetch) throw new Error("Network request blocked. Allow HTTP requests explicitly, if needed.");
            const s = await this._fetch(e, this._fetchConfig);
            switch (n) {
                case "view":
                    return new Uint8Array(await s.arrayBuffer());
                case "text":
                    return s.text()
            }
        } else switch (n) {
            case "view":
                return this._fs.readFile(e);
            case "text":
                return this._fs.readFile(e, "utf8")
        }
    }
    resolve(e, n) {
        return nn.isAbsoluteURL(e) || nn.isAbsoluteURL(n) ? nn.resolve(e, n) : this._path.resolve(e, decodeURIComponent(n))
    }
    dirname(e) {
        return nn.isAbsoluteURL(e) ? nn.dirname(e) : this._path.dirname(e)
    }
    async write(e, n) {
        await this.init(), await (!!e.match(/\.glb$/) ? this._writeGLB(e, n) : this._writeGLTF(e, n))
    }
    async _writeGLTF(e, n) {
        var s = this;
        this.lastWriteBytes = 0;
        const {
            json: r,
            resources: i
        } = await this.writeJSON(n, {
            format: Tn.GLTF,
            basename: rs.basename(e)
        }), {
            _fs: o,
            _path: c
        } = this, f = c.dirname(e), _ = JSON.stringify(r, null, 2);
        await o.writeFile(e, _), this.lastWriteBytes += _.length;
        for (const M of wh(Object.keys(i), 10)) await Promise.all(M.map(async function (A) {
            if (nn.isAbsoluteURL(A)) {
                if (nn.extension(A) === "bin") throw new Error(`Cannot write buffer to path "${A}".`);
                return
            }
            const I = c.join(f, decodeURIComponent(A));
            await o.mkdir(c.dirname(I), {
                recursive: !0
            }), await o.writeFile(I, i[A]), s.lastWriteBytes += i[A].byteLength
        }))
    }
    async _writeGLB(e, n) {
        const s = await this.writeBinary(n);
        await this._fs.writeFile(e, s), this.lastWriteBytes = s.byteLength
    }
}

function wh(t, e) {
    const n = [];
    for (let s = 0, r = t.length; s < r; s += e) {
        const i = [];
        for (let o = 0; o < e && s + o < r; o++) i.push(t[s + o]);
        n.push(i)
    }
    return n
}
class vh {
    constructor(e) {
        N(this, "attributes", []);
        N(this, "offset", 0);
        this.vertexFormat = e
    }
    build() {
        this.attributes = [], this.offset = 0;
        let e = 0;
        return this.vertexFormat.position && this.addAttribute(e++, "float32x3", 3), this.vertexFormat.normal && this.addAttribute(e++, "float32x3", 3), this.vertexFormat.color && this.addAttribute(e++, "float32x4", 4), this.vertexFormat.uv && this.addAttribute(e++, "float32x2", 2), {
            arrayStride: this.offset,
            attributes: this.attributes
        }
    }
    addAttribute(e, n, s) {
        this.attributes.push({
            shaderLocation: e,
            offset: this.offset,
            format: n
        }), this.offset += s * 4
    }
}
async function fc(t) {
    const e = new _h,
        s = await (await fetch(t)).arrayBuffer(),
        o = (await e.readBinary(new Uint8Array(s))).getRoot().listMeshes()[0].listPrimitives()[0],
        c = o.getAttribute("POSITION"),
        f = o.getAttribute("TEXCOORD_0"),
        _ = o.getAttribute("NORMAL"),
        M = o.getAttribute("COLOR_0"),
        A = o.getIndices();
    if (!c) throw new Error("Missing POSITION in the glTF file.");
    const I = new Float32Array(c.getArray()),
        H = A ? new Uint16Array(A.getArray()) : void 0,
        V = _ ? new Float32Array(_.getArray()) : void 0,
        G = f ? new Float32Array(f.getArray()) : void 0,
        j = M ? new Float32Array(M.getArray()) : void 0;
    if (G && G.length / 2 !== I.length / 3) throw console.error("UV count does not match vertex count!"), new Error("UV count does not match vertex count!");
    const T = new vh({
        position: I.length > 0,
        normal: V && V.length > 0,
        color: j && j.length > 0,
        uv: G && G.length > 0
    }).build(),
        Y = new Float32Array(I.length / 3 * (T.arrayStride / 4));
    for (let B = 0, F = 0; B < I.length / 3; B++) Y[F++] = I[B * 3 + 0], Y[F++] = I[B * 3 + 1], Y[F++] = I[B * 3 + 2], V && V.length > 0 && (Y[F++] = V[B * 3 + 0], Y[F++] = V[B * 3 + 1], Y[F++] = V[B * 3 + 2]), j && j.length > 0 && (Y[F++] = j[B * 4 + 0], Y[F++] = j[B * 4 + 1], Y[F++] = j[B * 4 + 2], Y[F++] = j[B * 4 + 3]), G && G.length > 0 && (Y[F++] = G[B * 2 + 0], Y[F++] = G[B * 2 + 1]);
    return {
        interleavedData: Y,
        indices: H,
        indexCount: H.length,
        vertexLayout: T
    }
}
class Wr {
    constructor(e, n, s, r = "rgba8unorm") {
        N(this, "texture");
        N(this, "view");
        this.texture = e.createTexture({
            size: [n, s, 1],
            format: r,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        }), this.view = this.texture.createView()
    }
    resize(e, n, s, r = "rgba8unorm") {
        this.texture.destroy(), this.texture = e.createTexture({
            size: [n, s, 1],
            format: r,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        }), this.view = this.texture.createView()
    }
}
const hc = `@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  var output: VertexOutput;
  // because hardcoded array; so we have to use vertexIndex for those arrays
  // otherwise for input.position, GPU handles this automatically
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(myTexture, mySampler, uv);
}`;
class bh {
    constructor(e, n, s) {
        N(this, "device");
        N(this, "pipeline");
        N(this, "bindGroupLayout");
        N(this, "sampler");
        this.device = e, this.sampler = s, this.bindGroupLayout = e.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }]
        }), this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({
                    code: hc
                }),
                entryPoint: "vs_main",
                buffers: []
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: hc
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: n
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        })
    }
    apply(e, n, s, r) {
        const i = n.A,
            o = {
                colorAttachments: [{
                    view: s,
                    clearValue: [0, 0, 0, 1],
                    loadOp: "clear",
                    storeOp: "store"
                }]
            },
            c = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: this.sampler
                }, {
                    binding: 1,
                    resource: i
                }]
            }),
            f = e.beginRenderPass(o);
        f.setPipeline(this.pipeline), f.setBindGroup(0, c), f.draw(6, 1, 0, 0), f.end()
    }
}
const dc = `@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> resolution: vec2<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let texel = 1.0 / resolution;
  let rgbNW = textureSample(myTexture, mySampler, uv + texel * vec2(-1.0, -1.0)).rgb;
  let rgbNE = textureSample(myTexture, mySampler, uv + texel * vec2( 1.0, -1.0)).rgb;
  let rgbSW = textureSample(myTexture, mySampler, uv + texel * vec2(-1.0,  1.0)).rgb;
  let rgbSE = textureSample(myTexture, mySampler, uv + texel * vec2( 1.0,  1.0)).rgb;
  let rgbM  = textureSample(myTexture, mySampler, uv).rgb;

  let luma = vec3<f32>(0.299, 0.587, 0.114);
  let lumaNW = dot(rgbNW, luma);
  let lumaNE = dot(rgbNE, luma);
  let lumaSW = dot(rgbSW, luma);
  let lumaSE = dot(rgbSE, luma);
  let lumaM  = dot(rgbM,  luma);

  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  var dir = vec2<f32>(
    -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
    ((lumaNW + lumaSW) - (lumaNE + lumaSE))
  );

  let dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * 0.5, 1.0 / 32.0);
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2<f32>(-8.0, -8.0), vec2<f32>(8.0, 8.0)) * texel;

  let rgbA = 0.5 * (
    textureSample(myTexture, mySampler, uv + dir * (1.0 / 3.0 - 0.5)).rgb +
    textureSample(myTexture, mySampler, uv + dir * (2.0 / 3.0 - 0.5)).rgb
  );
  let rgbB = rgbA * 0.5 + 0.25 * (
    textureSample(myTexture, mySampler, uv + dir * -0.5).rgb +
    textureSample(myTexture, mySampler, uv + dir * 0.5).rgb
  );

  let lumaB = dot(rgbB, luma);
  var color: vec4<f32>;
  if (lumaB < lumaMin || lumaB > lumaMax) {
      color = vec4<f32>(rgbA, 1.0);
  } else {
      color = vec4<f32>(rgbB, 1.0);
  }
  return color;
}`;
class xh {
    constructor(e, n, s, r) {
        N(this, "device");
        N(this, "pipeline");
        N(this, "sampler");
        N(this, "resolutionBuffer");
        N(this, "bindGroupLayout");
        this.device = e, this.sampler = s, this.bindGroupLayout = e.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }]
        }), this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({
                    code: dc
                }),
                entryPoint: "vs_main",
                buffers: []
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: dc
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: n
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        }), this.resolutionBuffer = e.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.resolutionBuffer, 0, new Float32Array(r))
    }
    apply(e, n, s, r) {
        const i = n.A;
        this.device.queue.writeBuffer(this.resolutionBuffer, 0, new Float32Array(r));
        const o = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: this.sampler
            }, {
                binding: 1,
                resource: i
            }, {
                binding: 2,
                resource: {
                    buffer: this.resolutionBuffer
                }
            }]
        }),
            c = {
                colorAttachments: [{
                    view: s,
                    clearValue: [0, 0, 0, 1],
                    loadOp: "clear",
                    storeOp: "store"
                }]
            },
            f = e.beginRenderPass(c);
        f.setPipeline(this.pipeline), f.setBindGroup(0, o), f.draw(6, 1, 0, 0), f.end()
    }
}
const Mr = `@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> threshold: f32;
@group(0) @binding(3) var<uniform> uGlow_ThresholdKnee: f32;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(myTexture, mySampler, uv);
  let brightness = max(max(color.r, color.g), color.b);

  // Soft-knee threshold using smoothstep
    let bloomFactor = smoothstep(threshold - uGlow_ThresholdKnee, threshold + uGlow_ThresholdKnee, brightness);
  return vec4<f32>(color.rgb * bloomFactor, color.a * bloomFactor);
}`;
class Eh {
    constructor(e, n, s, r, i) {
        N(this, "device");
        N(this, "pipeline");
        N(this, "bindGroupLayout");
        N(this, "sampler");
        N(this, "thresholdBuffer");
        N(this, "kneeBuffer");
        this.device = e, this.sampler = s, this.bindGroupLayout = e.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }]
        }), this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({
                    code: Mr
                }),
                entryPoint: "vs_main",
                buffers: []
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: Mr
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: n
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        }), this.thresholdBuffer = e.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.thresholdBuffer, 0, new Float32Array([r])), this.kneeBuffer = e.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.kneeBuffer, 0, new Float32Array([i])), this.pipeline = e.createRenderPipeline({
            layout: e.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: e.createShaderModule({
                    code: Mr
                }),
                entryPoint: "vs_main"
            },
            fragment: {
                module: e.createShaderModule({
                    code: Mr
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: n
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        })
    }
    apply(e, n, s, r) {
        const i = n.A,
            o = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: this.sampler
                }, {
                    binding: 1,
                    resource: i
                }, {
                    binding: 2,
                    resource: {
                        buffer: this.thresholdBuffer
                    }
                }, {
                    binding: 3,
                    resource: {
                        buffer: this.kneeBuffer
                    }
                }]
            }),
            c = {
                colorAttachments: [{
                    view: s,
                    clearValue: [0, 0, 0, 1],
                    loadOp: "clear",
                    storeOp: "store"
                }]
            },
            f = e.beginRenderPass(c);
        f.setPipeline(this.pipeline), f.setBindGroup(0, o), f.draw(6, 1, 0, 0), f.end()
    }
    setThreshold(e) {
        this.device.queue.writeBuffer(this.thresholdBuffer, 0, new Float32Array([e]))
    }
    setKnee(e) {
        this.device.queue.writeBuffer(this.kneeBuffer, 0, new Float32Array([e]))
    }
}
const pc = `@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> direction: vec2<f32>; // (1,0)=horizontal, (0,1)=vertical
@group(0) @binding(3) var<uniform> texelSize: vec2<f32>;
@group(0) @binding(4) var<uniform> radius: f32;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Clamp radius to a reasonable integer range (e.g., 1 to 8)
  let r = clamp(i32(radius), 1, 8);

  // Precomputed weights for a 9-tap Gaussian kernel (for radius up to 4)
  let weights = array<f32, 9>(
    0.016216, 0.054054, 0.121622, 0.194594, 0.227027, 0.194594, 0.121622, 0.054054, 0.016216
  );
  let offsets = array<f32, 9>(
    -4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0
  );

  var color = vec4<f32>(0.0);
  var total = 0.0;

  // Center index for weights/offsets
  let center = 4;

  // Use only taps within the current radius
  for (var i = -r; i <= r; i = i + 1) {
    let idx = i + center;
    let offset = direction * offsets[idx] * texelSize;
    color = color + textureSample(myTexture, mySampler, uv + offset) * weights[idx];
    total = total + weights[idx];
  }

  return color / total;
}`;
class gc {
    constructor(e, n, s, r, i, o) {
        N(this, "device");
        N(this, "pipeline");
        N(this, "bindGroupLayout");
        N(this, "sampler");
        N(this, "directionBuffer");
        N(this, "texelSizeBuffer");
        N(this, "radiusBuffer");
        this.device = e, this.sampler = s, this.bindGroupLayout = e.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }]
        }), this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({
                    code: pc
                }),
                entryPoint: "vs_main",
                buffers: []
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: pc
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: n
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        }), this.radiusBuffer = e.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.radiusBuffer, 0, new Float32Array([o])), this.directionBuffer = e.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.directionBuffer, 0, new Float32Array(r)), this.texelSizeBuffer = e.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.texelSizeBuffer, 0, new Float32Array(i))
    }
    apply(e, n, s, r) {
        const i = n.A;
        this.device.queue.writeBuffer(this.texelSizeBuffer, 0, new Float32Array([1 / r[0], 1 / r[1]]));
        const o = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [{
                binding: 0,
                resource: this.sampler
            }, {
                binding: 1,
                resource: i
            }, {
                binding: 2,
                resource: {
                    buffer: this.directionBuffer
                }
            }, {
                binding: 3,
                resource: {
                    buffer: this.texelSizeBuffer
                }
            }, {
                binding: 4,
                resource: {
                    buffer: this.radiusBuffer
                }
            }]
        }),
            c = {
                colorAttachments: [{
                    view: s,
                    clearValue: [0, 0, 0, 1],
                    loadOp: "clear",
                    storeOp: "store"
                }]
            },
            f = e.beginRenderPass(c);
        f.setPipeline(this.pipeline), f.setBindGroup(0, o), f.draw(6, 1, 0, 0), f.end()
    }
    setRadius(e) {
        this.device.queue.writeBuffer(this.radiusBuffer, 0, new Float32Array([e]))
    }
}
const mc = `@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var texA: texture_2d<f32>;
@group(0) @binding(2) var texB: texture_2d<f32>;
@group(0) @binding(3) var<uniform> intensity: f32;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  var uv = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );
  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let colorA = textureSample(texA, mySampler, uv);
  let colorB = textureSample(texB, mySampler, uv);

  // Optional: Clamp bloom to avoid over-bright
  let bloom = min(colorB * intensity, vec4<f32>(1.0));

  // Optional: Non-linear blend (screen blend)
  var result = 1.0 - (1.0 - colorA) * (1.0 - bloom);

  // // Or: Additive with soft clamp
  // var result = colorA + bloom;
  // result = min(result, vec4<f32>(1.0));

  // // Or: Additive with tonemapping (ACES or Reinhard)
  // var result = colorA + bloom;
  // result = result / (result + vec4<f32>(1.0));

  // Return
  return result;
  // return colorA + colorB * intensity;
}`;
class Ah {
    constructor(e, n, s, r) {
        N(this, "device");
        N(this, "pipeline");
        N(this, "sampler");
        N(this, "bindGroupLayout");
        N(this, "intensityBuffer");
        this.device = e, this.sampler = s, this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform"
                }
            }]
        }), this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: this.device.createShaderModule({
                    code: mc
                }),
                entryPoint: "vs_main",
                buffers: []
            },
            fragment: {
                module: this.device.createShaderModule({
                    code: mc
                }),
                entryPoint: "fs_main",
                targets: [{
                    format: n
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        }), this.intensityBuffer = e.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), e.queue.writeBuffer(this.intensityBuffer, 0, new Float32Array([r]))
    }
    apply(e, n, s, r) {
        const i = n.A,
            o = n.B,
            c = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: this.sampler
                }, {
                    binding: 1,
                    resource: i
                }, {
                    binding: 2,
                    resource: o
                }, {
                    binding: 3,
                    resource: {
                        buffer: this.intensityBuffer
                    }
                }]
            }),
            f = {
                colorAttachments: [{
                    view: s,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [0, 0, 0, 1]
                }]
            },
            _ = e.beginRenderPass(f);
        _.setPipeline(this.pipeline), _.setBindGroup(0, c), _.draw(6, 1, 0, 0), _.end()
    }
    setIntensity(e) {
        this.device.queue.writeBuffer(this.intensityBuffer, 0, new Float32Array([e]))
    }
}
class Th {
    constructor(e, n, s, r, i, o, c, f, _, M, A) {
        N(this, "device");
        N(this, "format");
        N(this, "sampler");
        N(this, "levels");
        N(this, "width");
        N(this, "height");
        N(this, "renderTargets", []);
        N(this, "brightPass");
        N(this, "blurH");
        N(this, "blurV");
        N(this, "add");
        N(this, "passThrough");
        this.device = e, this.format = n, this.sampler = s, this.levels = o, this.width = r, this.height = i, this.brightPass = c, this.blurH = f, this.blurV = _, this.add = M, this.passThrough = A, this.initRenderTargets()
    }
    initRenderTargets() {
        let e = this.width,
            n = this.height;
        for (let s = 0; s < this.levels; ++s) e = Math.max(1, Math.floor(e / 2)), n = Math.max(1, Math.floor(n / 2)), this.renderTargets.push({
            ping: new Wr(this.device, e, n, this.format),
            pong: new Wr(this.device, e, n, this.format),
            size: [e, n]
        })
    }
    apply(e, n, s) {
        this.brightPass.apply(e, {
            A: n
        }, this.renderTargets[0].ping.view, this.renderTargets[0].size);
        for (let i = 1; i < this.levels; ++i) this.passThrough.apply(e, {
            A: this.renderTargets[i - 1].ping.view
        }, this.renderTargets[i].ping.view, this.renderTargets[i].size);
        for (let i = 0; i < this.levels; ++i) this.blurH.apply(e, {
            A: this.renderTargets[i].ping.view
        }, this.renderTargets[i].pong.view, this.renderTargets[i].size), this.blurV.apply(e, {
            A: this.renderTargets[i].pong.view
        }, this.renderTargets[i].ping.view, this.renderTargets[i].size);
        let r = this.renderTargets[this.levels - 1].ping.view;
        for (let i = this.levels - 2; i >= 0; --i) this.add.apply(e, {
            A: this.renderTargets[i].ping.view,
            B: r
        }, this.renderTargets[i].pong.view, this.renderTargets[i].size), this.blurH.apply(e, {
            A: this.renderTargets[i].pong.view
        }, this.renderTargets[i].ping.view, this.renderTargets[i].size), this.blurV.apply(e, {
            A: this.renderTargets[i].ping.view
        }, this.renderTargets[i].pong.view, this.renderTargets[i].size), r = this.renderTargets[i].pong.view;
        this.add.apply(e, {
            A: n,
            B: r
        }, s, [this.width, this.height])
    }
}
class Sh {
    constructor(e, n, s, r, i) {
        N(this, "positionBuffer");
        N(this, "velocityBuffer");
        N(this, "randomBuffer");
        N(this, "meshSampleBuffer");
        N(this, "meshSampleCount");
        N(this, "particleCount");
        N(this, "setMeshSamples");
        N(this, "agesBuffer");
        N(this, "letterIDBuffer");
        if (this.particleCount = n, this.meshSampleCount = 0, this.meshSampleBuffer = e.createBuffer({
            size: 4 * 4 * 1,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }), this.positionBuffer = e.createBuffer({
            size: n * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        }), s && s.length === n * 4) e.queue.writeBuffer(this.positionBuffer, 0, s);
        else {
            const f = new Float32Array(n * 4);
            for (let _ = 0; _ < n; ++_) f[_ * 4 + 0] = (Math.random() - .5) * 4, f[_ * 4 + 1] = (Math.random() - .5) * 4, f[_ * 4 + 2] = (Math.random() - .5) * 4, f[_ * 4 + 3] = 1;
            e.queue.writeBuffer(this.positionBuffer, 0, f)
        }
        if (this.velocityBuffer = e.createBuffer({
            size: n * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        }), r && r.length === n * 4) e.queue.writeBuffer(this.velocityBuffer, 0, r);
        else {
            const f = new Float32Array(n * 4);
            for (let _ = 0; _ < n; ++_) f[_ * 4 + 0] = 0, f[_ * 4 + 1] = 0, f[_ * 4 + 2] = 0, f[_ * 4 + 3] = 0;
            e.queue.writeBuffer(this.velocityBuffer, 0, f)
        }
        if (this.randomBuffer = e.createBuffer({
            size: n * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }), i) e.queue.writeBuffer(this.randomBuffer, 0, i);
        else {
            const f = new Float32Array(n * 4);
            for (let _ = 0; _ < n; ++_) f[_ * 4 + 0] = Math.random(), f[_ * 4 + 1] = Math.random(), f[_ * 4 + 2] = Math.random(), f[_ * 4 + 3] = 0;
            e.queue.writeBuffer(this.randomBuffer, 0, f)
        }
        this.agesBuffer = e.createBuffer({
            size: n * 4 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
        });
        const o = new Float32Array(n * 4);
        o.fill(0), e.queue.writeBuffer(this.agesBuffer, 0, o), this.setMeshSamples = f => {
            this.meshSampleCount = f.length / 4, this.meshSampleBuffer && this.meshSampleBuffer.destroy(), this.meshSampleBuffer = e.createBuffer({
                size: f.length * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }), e.queue.writeBuffer(this.meshSampleBuffer, 0, f)
        }, this.letterIDBuffer = e.createBuffer({
            size: n * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
        });
        const c = new Float32Array(n);
        for (let f = 0; f < n; ++f) c[f] = f % 26;
        e.queue.writeBuffer(this.letterIDBuffer, 0, c.buffer)
    }
    updateParticles(e, n, s, r, i, o, c, f, _, M) {
        e.queue.writeBuffer(i, 0, new Float32Array([r]).buffer);
        const A = e.createBindGroup({
            layout: s.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.positionBuffer
                }
            }, {
                binding: 1,
                resource: {
                    buffer: this.velocityBuffer
                }
            }, {
                binding: 2,
                resource: {
                    buffer: this.randomBuffer
                }
            }, {
                binding: 3,
                resource: {
                    buffer: this.meshSampleBuffer
                }
            }, {
                binding: 4,
                resource: {
                    buffer: this.agesBuffer
                }
            }, {
                binding: 5,
                resource: {
                    buffer: i
                }
            }, {
                binding: 6,
                resource: {
                    buffer: o
                }
            }, {
                binding: 7,
                resource: {
                    buffer: c
                }
            }, {
                binding: 8,
                resource: {
                    buffer: f
                }
            }, {
                binding: 9,
                resource: {
                    buffer: _
                }
            }, {
                binding: 10,
                resource: {
                    buffer: this.letterIDBuffer
                }
            }, {
                binding: 11,
                resource: {
                    buffer: M
                }
            }]
        }),
            I = n.beginComputePass();
        I.setPipeline(s), I.setBindGroup(0, A);
        const V = Math.ceil(this.particleCount / 64);
        I.dispatchWorkgroups(V), I.end()
    }
}
const yc = `@group(0) @binding(0) var<uniform> projectionMatrix: mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix: mat4x4<f32>;
@group(0) @binding(2) var<uniform> modelMatrix: mat4x4<f32>;
@group(0) @binding(3) var myTexture: texture_2d<f32>;
@group(0) @binding(4) var mySampler: sampler;


struct VertexInput {
  @location(0) pos: vec4<f32>, // mesh vertex position (billboard quad) : slot 0
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>, 
  @location(3) instancePos: vec4<f32>, // per-particle position (xyz), w unused : slot 1
  @location(4) instanceVel: vec4<f32>, // per-particle velocity (xyz), w unused : slot 2
  @location(5) letterID: f32,
  @location(6) age: vec4<f32>,
};

struct VertexOutput {
  @builtin(position) pos: vec4<f32>,
  @location(1) localPos: vec4<f32>,
  @location(2) uv: vec2<f32>, 
  @location(3) letterID: f32,
};

@vertex
fn main_vertex(input: VertexInput) -> VertexOutput {
  var velocityMag = length(input.instanceVel.xyz);

  velocityMag = mix(0.01, 1.0, velocityMag);
  // use power to make velocityMag more extreme
  velocityMag = pow(velocityMag, 2.0);

  let scale = 0.04;
  let particleAge = input.age.x;
  // let scaledPos = input.pos * vec4<f32>(velocityMag * 0.1, 0.01, 0.01, 1.0);
  let scaledPos = input.pos * vec4<f32>(0.02 * particleAge, 0.02 * particleAge, 0.02 * particleAge, 1.0);

  let worldPos = modelMatrix * vec4<f32>(scaledPos.xyz, 1.0);
  let faceCamViewPos = viewMatrix * vec4<f32>(input.instancePos.xyz, 1.0);
  let addPos = worldPos + faceCamViewPos;
  return VertexOutput(
    projectionMatrix * addPos,
    input.pos,
    input.uv,
    input.letterID,
  );
}

@fragment
fn main_fragment(
  @location(1) localPos: vec4<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) letterID: f32,
) -> @location(0) vec4<f32> {
  // Use the normalized local mesh position as a 'normal' for color
  let normal = normalize(localPos.xyz);
  let color = normal * 0.5 + 0.5;

  // Example: pick letterID for this particle (replace with your logic)
  // let letterID: u32 = 0; // 0 for 'A', 1 for 'B', ..., 25 for 'Z'

  let gridSize: f32 = 6.0;
  let idx: u32 = u32(round(letterID));
  let cellU: f32 = f32(idx % 6u);
  let cellV: f32 = f32(idx / 6u);

  // Scale UV to cell size and offset to cell position
  let cellUV = uv / gridSize + vec2<f32>(cellU / gridSize, cellV / gridSize);

  let texColor = textureSample(myTexture, mySampler, cellUV);
  return texColor;
}`;
class Mh {
    constructor(e, n, s, r, i, o, c, f) {
        N(this, "pipeline");
        N(this, "viewMatrixBuffer");
        N(this, "projectionMatrixBuffer");
        N(this, "modelMatrixBuffer");
        N(this, "bindGroup");
        N(this, "meshVertexBuffer");
        N(this, "meshIndexBuffer");
        N(this, "meshIndexCount");
        N(this, "meshVertexLayout");
        N(this, "cubeTexture");
        N(this, "sampler");
        this.projectionMatrixBuffer = e.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), this.viewMatrixBuffer = e.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), this.modelMatrixBuffer = e.createBuffer({
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }), this.meshVertexBuffer = s, this.meshIndexBuffer = r, this.meshIndexCount = i, this.meshVertexLayout = o, this.cubeTexture = c, this.sampler = f;
        const _ = e.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform"
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float"
                }
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }]
        });
        this.pipeline = e.createRenderPipeline({
            layout: e.createPipelineLayout({
                bindGroupLayouts: [_]
            }),
            vertex: {
                module: e.createShaderModule({
                    code: yc
                }),
                entryPoint: "main_vertex",
                buffers: [this.meshVertexLayout, {
                    arrayStride: 16,
                    stepMode: "instance",
                    attributes: [{
                        shaderLocation: 3,
                        offset: 0,
                        format: "float32x4"
                    }]
                }, {
                    arrayStride: 16,
                    stepMode: "instance",
                    attributes: [{
                        shaderLocation: 4,
                        offset: 0,
                        format: "float32x4"
                    }]
                }, {
                    arrayStride: 4,
                    stepMode: "instance",
                    attributes: [{
                        shaderLocation: 5,
                        offset: 0,
                        format: "float32"
                    }]
                }, {
                    arrayStride: 16,
                    stepMode: "instance",
                    attributes: [{
                        shaderLocation: 6,
                        offset: 0,
                        format: "float32x4"
                    }]
                }]
            },
            fragment: {
                module: e.createShaderModule({
                    code: yc
                }),
                entryPoint: "main_fragment",
                targets: [{
                    format: n,
                    blend: {
                        color: {
                            srcFactor: "one",
                            dstFactor: "one",
                            operation: "add"
                        },
                        alpha: {
                            srcFactor: "one",
                            dstFactor: "one",
                            operation: "add"
                        }
                    }
                }]
            },
            primitive: {
                topology: "triangle-list"
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: !0,
                depthCompare: "less"
            }
        }), this.bindGroup = e.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.projectionMatrixBuffer
                }
            }, {
                binding: 1,
                resource: {
                    buffer: this.viewMatrixBuffer
                }
            }, {
                binding: 2,
                resource: {
                    buffer: this.modelMatrixBuffer
                }
            }, {
                binding: 3,
                resource: this.cubeTexture.createView()
            }, {
                binding: 4,
                resource: this.sampler
            }]
        })
    }
    updateUniforms(e, n, s, r) {
        e.queue.writeBuffer(this.projectionMatrixBuffer, 0, n.buffer, n.byteOffset, 64), e.queue.writeBuffer(this.viewMatrixBuffer, 0, s.buffer, s.byteOffset, 64), e.queue.writeBuffer(this.modelMatrixBuffer, 0, r.buffer, r.byteOffset, 64)
    }
    render(e, n) {
        e.setPipeline(this.pipeline), e.setBindGroup(0, this.bindGroup), e.setVertexBuffer(0, this.meshVertexBuffer), e.setVertexBuffer(1, n.positionBuffer), e.setVertexBuffer(2, n.velocityBuffer), e.setVertexBuffer(3, n.letterIDBuffer), e.setVertexBuffer(4, n.agesBuffer), e.setIndexBuffer(this.meshIndexBuffer, "uint16"), e.drawIndexed(this.meshIndexCount, n.particleCount)
    }
}
const Rh = `@group(0) @binding(0) var<storage, read_write> positions : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> velocities : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> randoms : array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> inMeshSamples : array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> ages : array<vec4<f32>>;
@group(0) @binding(5) var<uniform> uDeltaTime: f32;
@group(0) @binding(6) var<uniform> uTime: f32;
@group(0) @binding(7) var<uniform> uNoiseScale: f32; // Randomness factor
@group(0) @binding(8) var<uniform> uAirResistance: f32; // Air resistance factor
@group(0) @binding(9) var<uniform> uBoundaryRadius: f32; // Boundary radius
@group(0) @binding(10) var<storage, read_write> letterID: array<f32>; // Output letter IDs
@group(0) @binding(11) var<uniform> uLettersID: array<vec4<u32>, 8>; // Buffer for recognized letters

// arrayLength is not supported on some devices, so used a fixed value
const MESH_SAMPLE_COUNT: u32 = 2000u;

fn mod289_vec3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_vec4(x: vec4<f32>) -> vec4<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4<f32>) -> vec4<f32> {
  return mod289_vec4(((x * 34.0) + 1.0) * x);
}

fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> {
  return 1.79284291400159 - 0.85373472095314 * r;
}

fn snoise(v: vec3<f32>) -> f32 {
  let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
  let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

  var i = floor(v + dot(v, C.yyy));
  let x0 = v - i + dot(i, C.xxx);

  let g = step(x0.yzx, x0.xyz);
  let l = 1.0 - g;
  let i1 = min(g.xyz, l.zxy);
  let i2 = max(g.xyz, l.zxy);

  let x1 = x0 - i1 + C.xxx;
  let x2 = x0 - i2 + 2.0 * C.xxx;
  let x3 = x0 - 1.0 + 3.0 * C.xxx;

  i = mod289_vec3(i);

  let p = permute(
    permute(
      permute(vec4<f32>(i.z) + vec4<f32>(0.0, i1.z, i2.z, 1.0))
      + vec4<f32>(i.y) + vec4<f32>(0.0, i1.y, i2.y, 1.0)
    )
    + vec4<f32>(i.x) + vec4<f32>(0.0, i1.x, i2.x, 1.0)
  );

  let n_ = 1.0 / 7.0;
  let ns = n_ * D.wyz - D.xzx;

  let j = p - 49.0 * floor(p * ns.z * ns.z);

  let x_ = floor(j * ns.z);
  let y_ = floor(j - 7.0 * x_);

  let x = x_ * ns.x + ns.yyyy;
  let y = y_ * ns.x + ns.yyyy;
  let h = 1.0 - abs(x) - abs(y);

  let b0 = vec4<f32>(x.xy, y.xy);
  let b1 = vec4<f32>(x.zw, y.zw);

  let s0 = floor(b0) * 2.0 + 1.0;
  let s1 = floor(b1) * 2.0 + 1.0;
  let sh = -step(h, vec4<f32>(0.0));

  let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  let a1 = b1.xzyw + s1.xzyw * sh.zzww;

  var p0 = vec3<f32>(a0.xy, h.x);
  var p1 = vec3<f32>(a0.zw, h.y);
  var p2 = vec3<f32>(a1.xy, h.z);
  var p3 = vec3<f32>(a1.zw, h.w);

  let norm = taylorInvSqrt(vec4<f32>(
    dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)
  ));
  p0 = p0 * norm.x;
  p1 = p1 * norm.y;
  p2 = p2 * norm.z;
  p3 = p3 * norm.w;

  var m = max(0.6 - vec4<f32>(
    dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)
  ), vec4<f32>(0.0));
  m = m * m;

  return 42.0 * dot(
    m * m,
    vec4<f32>(
      dot(p0, x0),
      dot(p1, x1),
      dot(p2, x2),
      dot(p3, x3)
    )
  );
}

fn snoiseVec3(x: vec3<f32>) -> vec3<f32> {
  let s = snoise(x);
  let s1 = snoise(vec3<f32>(x.y - 19.1, x.z + 33.4, x.x + 47.2));
  let s2 = snoise(vec3<f32>(x.z + 74.2, x.x - 124.5, x.y + 99.4));
  return vec3<f32>(s, s1, s2);
}

fn curlNoise(p: vec3<f32>) -> vec3<f32> {
  let e = 0.1;
  let dx = vec3<f32>(e, 0.0, 0.0);
  let dy = vec3<f32>(0.0, e, 0.0);
  let dz = vec3<f32>(0.0, 0.0, e);

  let p_x0 = snoiseVec3(p - dx);
  let p_x1 = snoiseVec3(p + dx);
  let p_y0 = snoiseVec3(p - dy);
  let p_y1 = snoiseVec3(p + dy);
  let p_z0 = snoiseVec3(p - dz);
  let p_z1 = snoiseVec3(p + dz);

  let x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  let y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  let z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

  let divisor = 1.0 / (2.0 * e);
  return normalize(vec3<f32>(x, y, z) * divisor);
}

// Convert a 3x3 rotation matrix to a quaternion
fn quat_from_matrix(m: mat3x3<f32>) -> vec4<f32> {
  let trace = m[0][0] + m[1][1] + m[2][2];
  var q = vec4<f32>(0.0);
  if (trace > 0.0) {
    let s = sqrt(trace + 1.0) * 2.0;
    q.w = 0.25 * s;
    q.x = (m[2][1] - m[1][2]) / s;
    q.y = (m[0][2] - m[2][0]) / s;
    q.z = (m[1][0] - m[0][1]) / s;
  } else if ((m[0][0] > m[1][1]) && (m[0][0] > m[2][2])) {
    let s = sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2.0;
    q.w = (m[2][1] - m[1][2]) / s;
    q.x = 0.25 * s;
    q.y = (m[0][1] + m[1][0]) / s;
    q.z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    let s = sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2.0;
    q.w = (m[0][2] - m[2][0]) / s;
    q.x = (m[0][1] + m[1][0]) / s;
    q.y = 0.25 * s;
    q.z = (m[1][2] + m[2][1]) / s;
  } else {
    let s = sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2.0;
    q.w = (m[1][0] - m[0][1]) / s;
    q.x = (m[0][2] + m[2][0]) / s;
    q.y = (m[1][2] + m[2][1]) / s;
    q.z = 0.25 * s;
  }
  return normalize(q);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;

  // Simple Euler integration (in-place)
  var pos = positions[idx];
  var vel = velocities[idx];
  let ran = randoms[idx];
  var age = ages[idx];
  var textID = letterID[idx];

  // Set acceleration
  var acceleration = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  let noise_val = curlNoise(pos.xyz * 0.5 * uNoiseScale + vec3<f32>(uTime * 0.04 * uNoiseScale));
  acceleration = acceleration + vec4<f32>(noise_val, 0.0);

  // set boundary
  let dist_to_center = length(pos - vec4<f32>(0.0, 0.0, 0.0, 1.0));
  let boundary_dir = -normalize(pos - vec4<f32>(0.0, 0.0, 0.0, 1.0));
  let boundary_force = smoothstep(uBoundaryRadius * 0.75, uBoundaryRadius, dist_to_center);
  acceleration = acceleration + boundary_dir * boundary_force * 1.0;

  // Set velocity
  vel = vel + acceleration * 10.0 * uDeltaTime;
  let velocity_random = mix(1.0, 8.0, ran.x);
  vel = vel * (1.0 - mix(0.05, 1.0, uAirResistance));
  
  // Set position
  pos = pos + vel * velocity_random * uDeltaTime;

  // Update age
  let lifespan = mix(0.02, 1.0, ran.z); // Each particle gets a random lifespan between 2 and 6 seconds
  age.x = age.x - uDeltaTime;

  // Re-emit if age exceeds lifespan
  if (age.x < 0.0) {
    // let meshSampleCount = arrayLength(&inMeshSamples);
    let meshSampleCount = MESH_SAMPLE_COUNT;
    let randomIdx = u32(abs(fract(ran.y) * f32(meshSampleCount)));
    // pos = inMeshSamples[randomIdx];
    pos = (inMeshSamples[randomIdx] * 1.5) + vec4<f32>(0.0, 0.3, 0.0, 0.0); // Move up then scale up
    let rotationAngle = 3.14159; // 180 degrees in
    let rotationMatrix = mat3x3<f32>(
      cos(rotationAngle), 0.0, sin(rotationAngle),
      0.0, 1.0, 0.0,
      -sin(rotationAngle), 0.0, cos(rotationAngle)
    );
    pos = vec4<f32>(rotationMatrix * pos.xyz, 1.0 );
    vel = vec4<f32>(0.0, 0.0, 0.0, 0.0);

    // To process lettersBuffer into letterID
    let letterIdx = idx * 32u / MESH_SAMPLE_COUNT; // idx in [0, PARTICLE_COUNT)
    let vecIdx = letterIdx / 4u;
    let subIdx = letterIdx % 4u;
    let selectedLetterCode = uLettersID[vecIdx][subIdx]; // 0 for "A", 1 for "B"

    textID = f32(selectedLetterCode); // Or use as needed

    age.x = lifespan;
  } 
  // else {
  //   // Persist previous value
  //   textID = inLetterID[idx];
  // }

  positions[idx] = pos;
  velocities[idx] = vel;
  ages[idx] = age;
  letterID[idx] = textID;
}`;
var xs = typeof self < "u" ? self : {};

function Xn() {
    throw Error("Invalid UTF8")
}

function _c(t, e) {
    return e = String.fromCharCode.apply(null, e), t == null ? e : t + e
}
let Rr, ki;
const Ph = typeof TextDecoder < "u";
let Bh;
const Ih = typeof TextEncoder < "u";

function Xu(t) {
    if (Ih) t = (Bh || (Bh = new TextEncoder)).encode(t);
    else {
        let n = 0;
        const s = new Uint8Array(3 * t.length);
        for (let r = 0; r < t.length; r++) {
            var e = t.charCodeAt(r);
            if (e < 128) s[n++] = e;
            else {
                if (e < 2048) s[n++] = e >> 6 | 192;
                else {
                    if (e >= 55296 && e <= 57343) {
                        if (e <= 56319 && r < t.length) {
                            const i = t.charCodeAt(++r);
                            if (i >= 56320 && i <= 57343) {
                                e = 1024 * (e - 55296) + i - 56320 + 65536, s[n++] = e >> 18 | 240, s[n++] = e >> 12 & 63 | 128, s[n++] = e >> 6 & 63 | 128, s[n++] = 63 & e | 128;
                                continue
                            }
                            r--
                        }
                        e = 65533
                    }
                    s[n++] = e >> 12 | 224, s[n++] = e >> 6 & 63 | 128
                }
                s[n++] = 63 & e | 128
            }
        }
        t = n === s.length ? s : s.subarray(0, n)
    }
    return t
}
var Lo, Yr;
e: {
    for (var wc = ["CLOSURE_FLAGS"], Ui = xs, Fi = 0; Fi < wc.length; Fi++)
        if ((Ui = Ui[wc[Fi]]) == null) {
            Yr = null;
            break e
        } Yr = Ui
}
var rr, vc = Yr && Yr[610401301];
Lo = vc != null && vc;
const bc = xs.navigator;

function ro(t) {
    return !!Lo && !!rr && rr.brands.some(({
        brand: e
    }) => e && e.indexOf(t) != -1)
}

function Kt(t) {
    var e;
    return (e = xs.navigator) && (e = e.userAgent) || (e = ""), e.indexOf(t) != -1
}

function Ln() {
    return !!Lo && !!rr && rr.brands.length > 0
}

function Ci() {
    return Ln() ? ro("Chromium") : (Kt("Chrome") || Kt("CriOS")) && !(!Ln() && Kt("Edge")) || Kt("Silk")
}

function si(t) {
    return si[" "](t), t
}
rr = bc && bc.userAgentData || null, si[" "] = function () { };
var Oh = !Ln() && (Kt("Trident") || Kt("MSIE"));
!Kt("Android") || Ci(), Ci(), Kt("Safari") && (Ci() || !Ln() && Kt("Coast") || !Ln() && Kt("Opera") || !Ln() && Kt("Edge") || (Ln() ? ro("Microsoft Edge") : Kt("Edg/")) || Ln() && ro("Opera"));
var Ku = {},
    Ys = null;

function Lh(t) {
    const e = t.length;
    let n = 3 * e / 4;
    n % 3 ? n = Math.floor(n) : "=.".indexOf(t[e - 1]) != -1 && (n = "=.".indexOf(t[e - 2]) != -1 ? n - 2 : n - 1);
    const s = new Uint8Array(n);
    let r = 0;
    return function (i, o) {
        function c(_) {
            for (; f < i.length;) {
                const M = i.charAt(f++),
                    A = Ys[M];
                if (A != null) return A;
                if (!/^[\s\xa0]*$/.test(M)) throw Error("Unknown base64 encoding at char: " + M)
            }
            return _
        }
        Ju();
        let f = 0;
        for (; ;) {
            const _ = c(-1),
                M = c(0),
                A = c(64),
                I = c(64);
            if (I === 64 && _ === -1) break;
            o(_ << 2 | M >> 4), A != 64 && (o(M << 4 & 240 | A >> 2), I != 64 && o(A << 6 & 192 | I))
        }
    }(t, function (i) {
        s[r++] = i
    }), r !== n ? s.subarray(0, r) : s
}

function Ju() {
    if (!Ys) {
        Ys = {};
        var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""),
            e = ["+/=", "+/", "-_=", "-_.", "-_"];
        for (let n = 0; n < 5; n++) {
            const s = t.concat(e[n].split(""));
            Ku[n] = s;
            for (let r = 0; r < s.length; r++) {
                const i = s[r];
                Ys[i] === void 0 && (Ys[i] = r)
            }
        }
    }
}
var Zu = typeof Uint8Array < "u",
    Qu = !Oh && typeof btoa == "function";

function xc(t) {
    if (!Qu) {
        var e;
        e === void 0 && (e = 0), Ju(), e = Ku[e];
        var n = Array(Math.floor(t.length / 3)),
            s = e[64] || "";
        let f = 0,
            _ = 0;
        for (; f < t.length - 2; f += 3) {
            var r = t[f],
                i = t[f + 1],
                o = t[f + 2],
                c = e[r >> 2];
            r = e[(3 & r) << 4 | i >> 4], i = e[(15 & i) << 2 | o >> 6], o = e[63 & o], n[_++] = c + r + i + o
        }
        switch (c = 0, o = s, t.length - f) {
            case 2:
                o = e[(15 & (c = t[f + 1])) << 2] || s;
            case 1:
                t = t[f], n[_] = e[t >> 2] + e[(3 & t) << 4 | c >> 4] + o + s
        }
        return n.join("")
    }
    for (e = "", n = 0, s = t.length - 10240; n < s;) e += String.fromCharCode.apply(null, t.subarray(n, n += 10240));
    return e += String.fromCharCode.apply(null, n ? t.subarray(n) : t), btoa(e)
}
const Ec = /[-_.]/g,
    Nh = {
        "-": "+",
        _: "/",
        ".": "="
    };

function kh(t) {
    return Nh[t] || ""
}

function el(t) {
    if (!Qu) return Lh(t);
    Ec.test(t) && (t = t.replace(Ec, kh)), t = atob(t);
    const e = new Uint8Array(t.length);
    for (let n = 0; n < t.length; n++) e[n] = t.charCodeAt(n);
    return e
}

function os(t) {
    return Zu && t != null && t instanceof Uint8Array
}
var Es = {};

function as() {
    return Uh || (Uh = new Sn(null, Es))
}

function No(t) {
    tl(Es);
    var e = t.g;
    return (e = e == null || os(e) ? e : typeof e == "string" ? el(e) : null) == null ? e : t.g = e
}
var Sn = class {
    h() {
        return new Uint8Array(No(this) || 0)
    }
    constructor(t, e) {
        if (tl(e), this.g = t, t != null && t.length === 0) throw Error("ByteString should be constructed with non-empty values")
    }
};
let Uh, Fh;

function tl(t) {
    if (t !== Es) throw Error("illegal external caller")
}

function nl(t, e) {
    t.__closure__error__context__984382 || (t.__closure__error__context__984382 = {}), t.__closure__error__context__984382.severity = e
}

function io(t) {
    return nl(t = Error(t), "warning"), t
}

function ko(t) {
    if (t != null) {
        var e = Fh ?? (Fh = {}),
            n = e[t] || 0;
        n >= 5 || (e[t] = n + 1, nl(t = Error(), "incident"), function (s) {
            xs.setTimeout(() => {
                throw s
            }, 0)
        }(t))
    }
}
var ri = typeof Symbol == "function" && typeof Symbol() == "symbol";

function Ls(t, e, n = !1) {
    return typeof Symbol == "function" && typeof Symbol() == "symbol" ? n && Symbol.for && t ? Symbol.for(t) : t != null ? Symbol(t) : Symbol() : e
}
var Ch = Ls("jas", void 0, !0),
    Ac = Ls(void 0, "0di"),
    Hs = Ls(void 0, "1oa"),
    As = Ls(void 0, Symbol()),
    Dh = Ls(void 0, "0actk"),
    sl = Ls(void 0, "8utk");
const le = ri ? Ch : "Ea",
    rl = {
        Ea: {
            value: 0,
            configurable: !0,
            writable: !0,
            enumerable: !1
        }
    },
    il = Object.defineProperties;

function ii(t, e) {
    ri || le in t || il(t, rl), t[le] |= e
}

function Je(t, e) {
    ri || le in t || il(t, rl), t[le] = e
}

function Ns(t) {
    return ii(t, 34), t
}

function Gh(t, e) {
    Je(e, -15615 & (0 | t))
}

function oo(t, e) {
    Je(e, -15581 & (34 | t))
}

function oi() {
    return typeof BigInt == "function"
}

function Bt(t) {
    return Array.prototype.slice.call(t)
}
var Uo, fr = {};

function ai(t) {
    return t !== null && typeof t == "object" && !Array.isArray(t) && t.constructor === Object
}

function Fo(t, e) {
    if (t != null) {
        if (typeof t == "string") t = t ? new Sn(t, Es) : as();
        else if (t.constructor !== Sn)
            if (os(t)) t = t.length ? new Sn(new Uint8Array(t), Es) : as();
            else {
                if (!e) throw Error();
                t = void 0
            }
    }
    return t
}
const Tc = [];

function Wn(t) {
    if (2 & t) throw Error()
}
Je(Tc, 55), Uo = Object.freeze(Tc);
class Sc {
    constructor(e, n, s) {
        this.g = e, this.h = n, this.l = s
    }
    next() {
        const e = this.g.next();
        return e.done || (e.value = this.h.call(this.l, e.value)), e
    } [Symbol.iterator]() {
        return this
    }
}

function Co(t) {
    return As ? t[As] : void 0
}
var Vh = Object.freeze({});

function ci(t) {
    return t.Na = !0, t
}
var zh = ci(t => typeof t == "number"),
    Mc = ci(t => typeof t == "string"),
    jh = ci(t => typeof t == "boolean"),
    ui = typeof xs.BigInt == "function" && typeof xs.BigInt(0) == "bigint";

function Un(t) {
    var e = t;
    if (Mc(e)) {
        if (!/^\s*(?:-?[1-9]\d*|0)?\s*$/.test(e)) throw Error(String(e))
    } else if (zh(e) && !Number.isSafeInteger(e)) throw Error(String(e));
    return ui ? BigInt(t) : t = jh(t) ? t ? "1" : "0" : Mc(t) ? t.trim() || "0" : String(t)
}
var ao = ci(t => ui ? t >= qh && t <= Yh : t[0] === "-" ? Rc(t, Hh) : Rc(t, Wh));
const Hh = Number.MIN_SAFE_INTEGER.toString(),
    qh = ui ? BigInt(Number.MIN_SAFE_INTEGER) : void 0,
    Wh = Number.MAX_SAFE_INTEGER.toString(),
    Yh = ui ? BigInt(Number.MAX_SAFE_INTEGER) : void 0;

function Rc(t, e) {
    if (t.length > e.length) return !1;
    if (t.length < e.length || t === e) return !0;
    for (let n = 0; n < t.length; n++) {
        const s = t[n],
            r = e[n];
        if (s > r) return !1;
        if (s < r) return !0
    }
}
const $h = typeof Uint8Array.prototype.slice == "function";
let ol, Le = 0,
    We = 0;

function Pc(t) {
    const e = t >>> 0;
    Le = e, We = (t - e) / 4294967296 >>> 0
}

function cs(t) {
    if (t < 0) {
        Pc(-t);
        const [e, n] = zo(Le, We);
        Le = e >>> 0, We = n >>> 0
    } else Pc(t)
}

function Do(t) {
    const e = ol || (ol = new DataView(new ArrayBuffer(8)));
    e.setFloat32(0, +t, !0), We = 0, Le = e.getUint32(0, !0)
}

function Go(t, e) {
    const n = 4294967296 * e + (t >>> 0);
    return Number.isSafeInteger(n) ? n : ir(t, e)
}

function Vo(t, e) {
    const n = 2147483648 & e;
    return n && (e = ~e >>> 0, (t = 1 + ~t >>> 0) == 0 && (e = e + 1 >>> 0)), typeof (t = Go(t, e)) == "number" ? n ? -t : t : n ? "-" + t : t
}

function ir(t, e) {
    if (t >>>= 0, (e >>>= 0) <= 2097151) var n = "" + (4294967296 * e + t);
    else oi() ? n = "" + (BigInt(e) << BigInt(32) | BigInt(t)) : (t = (16777215 & t) + 6777216 * (n = 16777215 & (t >>> 24 | e << 8)) + 6710656 * (e = e >> 16 & 65535), n += 8147497 * e, e *= 2, t >= 1e7 && (n += t / 1e7 >>> 0, t %= 1e7), n >= 1e7 && (e += n / 1e7 >>> 0, n %= 1e7), n = e + Bc(n) + Bc(t));
    return n
}

function Bc(t) {
    return t = String(t), "0000000".slice(t.length) + t
}

function al() {
    var t = Le,
        e = We;
    if (2147483648 & e)
        if (oi()) t = "" + (BigInt(0 | e) << BigInt(32) | BigInt(t >>> 0));
        else {
            const [n, s] = zo(t, e);
            t = "-" + ir(n, s)
        }
    else t = ir(t, e);
    return t
}

function li(t) {
    if (t.length < 16) cs(Number(t));
    else if (oi()) t = BigInt(t), Le = Number(t & BigInt(4294967295)) >>> 0, We = Number(t >> BigInt(32) & BigInt(4294967295));
    else {
        const e = +(t[0] === "-");
        We = Le = 0;
        const n = t.length;
        for (let s = e, r = (n - e) % 6 + e; r <= n; s = r, r += 6) {
            const i = Number(t.slice(s, r));
            We *= 1e6, Le = 1e6 * Le + i, Le >= 4294967296 && (We += Math.trunc(Le / 4294967296), We >>>= 0, Le >>>= 0)
        }
        if (e) {
            const [s, r] = zo(Le, We);
            Le = s, We = r
        }
    }
}

function zo(t, e) {
    return e = ~e, t ? t = 1 + ~t : e += 1, [t, e]
}
const or = typeof BigInt == "function" ? BigInt.asIntN : void 0,
    Xh = typeof BigInt == "function" ? BigInt.asUintN : void 0,
    Fn = Number.isSafeInteger,
    fi = Number.isFinite,
    Ts = Math.trunc,
    Kh = Un(0);

function Yn(t) {
    return t == null || typeof t == "number" ? t : t === "NaN" || t === "Infinity" || t === "-Infinity" ? Number(t) : void 0
}

function cl(t) {
    return t == null || typeof t == "boolean" ? t : typeof t == "number" ? !!t : void 0
}
const Jh = /^-?([1-9][0-9]*|0)(\.[0-9]+)?$/;

function ar(t) {
    switch (typeof t) {
        case "bigint":
            return !0;
        case "number":
            return fi(t);
        case "string":
            return Jh.test(t);
        default:
            return !1
    }
}

function ks(t) {
    if (t == null) return t;
    if (typeof t == "string" && t) t = +t;
    else if (typeof t != "number") return;
    return fi(t) ? 0 | t : void 0
}

function ul(t) {
    if (t == null) return t;
    if (typeof t == "string" && t) t = +t;
    else if (typeof t != "number") return;
    return fi(t) ? t >>> 0 : void 0
}

function Ic(t) {
    if (t[0] === "-") return !1;
    const e = t.length;
    return e < 20 || e === 20 && Number(t.substring(0, 6)) < 184467
}

function ll(t) {
    const e = t.length;
    return t[0] === "-" ? e < 20 || e === 20 && Number(t.substring(0, 7)) > -922337 : e < 19 || e === 19 && Number(t.substring(0, 6)) < 922337
}

function fl(t) {
    return ll(t) ? t : (li(t), al())
}

function jo(t) {
    return t = Ts(t), Fn(t) || (cs(t), t = Vo(Le, We)), t
}

function hl(t) {
    var e = Ts(Number(t));
    return Fn(e) ? String(e) : ((e = t.indexOf(".")) !== -1 && (t = t.substring(0, e)), fl(t))
}

function Oc(t) {
    var e = Ts(Number(t));
    return Fn(e) ? Un(e) : ((e = t.indexOf(".")) !== -1 && (t = t.substring(0, e)), oi() ? Un(or(64, BigInt(t))) : Un(fl(t)))
}

function Lc(t) {
    if (Fn(t)) t = Un(jo(t));
    else {
        if (t = Ts(t), Fn(t)) t = String(t);
        else {
            const e = String(t);
            ll(e) ? t = e : (cs(t), t = al())
        }
        t = Un(t)
    }
    return t
}

function co(t) {
    return t == null ? t : typeof t == "bigint" ? (ao(t) ? t = Number(t) : (t = or(64, t), t = ao(t) ? Number(t) : String(t)), t) : ar(t) ? typeof t == "number" ? jo(t) : hl(t) : void 0
}

function Zh(t) {
    if (t == null) return t;
    var e = typeof t;
    if (e === "bigint") return String(Xh(64, t));
    if (ar(t)) {
        if (e === "string") return e = Ts(Number(t)), Fn(e) && e >= 0 ? t = String(e) : ((e = t.indexOf(".")) !== -1 && (t = t.substring(0, e)), Ic(t) || (li(t), t = ir(Le, We))), t;
        if (e === "number") return (t = Ts(t)) >= 0 && Fn(t) ? t : function (n) {
            if (n < 0) {
                cs(n);
                var s = ir(Le, We);
                return n = Number(s), Fn(n) ? n : s
            }
            return Ic(s = String(n)) ? s : (cs(n), Go(Le, We))
        }(t)
    }
}

function dl(t) {
    if (typeof t != "string") throw Error();
    return t
}

function Us(t) {
    if (t != null && typeof t != "string") throw Error();
    return t
}

function Ss(t) {
    return t == null || typeof t == "string" ? t : void 0
}

function Ho(t, e, n, s) {
    if (t != null && typeof t == "object" && t.W === fr) return t;
    if (!Array.isArray(t)) return n ? 2 & s ? ((t = e[Ac]) || (Ns((t = new e).u), t = e[Ac] = t), e = t) : e = new e : e = void 0, e;
    let r = n = 0 | t[le];
    return r === 0 && (r |= 32 & s), r |= 2 & s, r !== n && Je(t, r), new e(t)
}

function Qh(t, e, n) {
    if (e) e: {
        if (!ar(e = t)) throw io("int64");
        switch (typeof e) {
            case "string":
                e = Oc(e);
                break e;
            case "bigint":
                e = Un(or(64, e));
                break e;
            default:
                e = Lc(e)
        }
    }
    else t = typeof (e = t), e = e == null ? e : t === "bigint" ? Un(or(64, e)) : ar(e) ? t === "string" ? Oc(e) : Lc(e) : void 0;
    return (t = e) == null ? n ? Kh : void 0 : t
}

function e2(t) {
    return t
}
const t2 = {};
let n2 = function () {
    try {
        return si(new class extends Map {
            constructor() {
                super()
            }
        }), !1
    } catch {
        return !0
    }
}();
class Di {
    constructor() {
        this.g = new Map
    }
    get(e) {
        return this.g.get(e)
    }
    set(e, n) {
        return this.g.set(e, n), this.size = this.g.size, this
    }
    delete(e) {
        return e = this.g.delete(e), this.size = this.g.size, e
    }
    clear() {
        this.g.clear(), this.size = this.g.size
    }
    has(e) {
        return this.g.has(e)
    }
    entries() {
        return this.g.entries()
    }
    keys() {
        return this.g.keys()
    }
    values() {
        return this.g.values()
    }
    forEach(e, n) {
        return this.g.forEach(e, n)
    } [Symbol.iterator]() {
        return this.entries()
    }
}
const s2 = n2 ? (Object.setPrototypeOf(Di.prototype, Map.prototype), Object.defineProperties(Di.prototype, {
    size: {
        value: 0,
        configurable: !0,
        enumerable: !0,
        writable: !0
    }
}), Di) : class extends Map {
    constructor() {
        super()
    }
};

function Nc(t) {
    return t
}

function Gi(t) {
    if (2 & t.M) throw Error("Cannot mutate an immutable Map")
}
var _n = class extends s2 {
    constructor(t, e, n = Nc, s = Nc) {
        super();
        let r = 0 | t[le];
        r |= 64, Je(t, r), this.M = r, this.I = e, this.S = n, this.X = this.I ? r2 : s;
        for (let i = 0; i < t.length; i++) {
            const o = t[i],
                c = n(o[0], !1, !0);
            let f = o[1];
            e ? f === void 0 && (f = null) : f = s(o[1], !1, !0, void 0, void 0, r), super.set(c, f)
        }
    }
    La() {
        var t = u2;
        if (this.size !== 0) return Array.from(super.entries(), e => (e[0] = t(e[0]), e[1] = t(e[1]), e))
    }
    da(t = i2) {
        const e = [],
            n = super.entries();
        for (var s; !(s = n.next()).done;)(s = s.value)[0] = t(s[0]), s[1] = t(s[1]), e.push(s);
        return e
    }
    clear() {
        Gi(this), super.clear()
    }
    delete(t) {
        return Gi(this), super.delete(this.S(t, !0, !1))
    }
    entries() {
        if (this.I) {
            var t = super.keys();
            t = new Sc(t, o2, this)
        } else t = super.entries();
        return t
    }
    values() {
        if (this.I) {
            var t = super.keys();
            t = new Sc(t, _n.prototype.get, this)
        } else t = super.values();
        return t
    }
    forEach(t, e) {
        this.I ? super.forEach((n, s, r) => {
            t.call(e, r.get(s), s, r)
        }) : super.forEach(t, e)
    }
    set(t, e) {
        return Gi(this), (t = this.S(t, !0, !1)) == null ? this : e == null ? (super.delete(t), this) : super.set(t, this.X(e, !0, !0, this.I, !1, this.M))
    }
    Ja(t) {
        const e = this.S(t[0], !1, !0);
        t = t[1], t = this.I ? t === void 0 ? null : t : this.X(t, !1, !0, void 0, !1, this.M), super.set(e, t)
    }
    has(t) {
        return super.has(this.S(t, !1, !1))
    }
    get(t) {
        t = this.S(t, !1, !1);
        const e = super.get(t);
        if (e !== void 0) {
            var n = this.I;
            return n ? ((n = this.X(e, !1, !0, n, this.pa, this.M)) !== e && super.set(t, n), n) : e
        }
    } [Symbol.iterator]() {
        return this.entries()
    }
};

function r2(t, e, n, s, r, i) {
    return t = Ho(t, s, n, i), r && (t = pi(t)), t
}

function i2(t) {
    return t
}

function o2(t) {
    return [t, this.get(t)]
}
let a2, pl, gl, c2;

function kc() {
    return a2 || (a2 = new _n(Ns([]), void 0, void 0, void 0, t2))
}

function uo(t, e, n, s, r) {
    if (t != null) {
        if (Array.isArray(t)) {
            const i = 0 | t[le];
            return t.length === 0 && 1 & i ? void 0 : r && 2 & i ? t : hi(t, e, n, s !== void 0, r)
        }
        return e(t, s)
    }
}

function hi(t, e, n, s, r) {
    const i = s || n ? 0 | t[le] : 0,
        o = s ? !!(32 & i) : void 0;
    let c = 0;
    const f = (s = Bt(t)).length;
    for (let V = 0; V < f; V++) {
        var _ = s[V];
        if (V === f - 1 && ai(_)) {
            var M = e,
                A = n,
                I = o,
                H = r;
            let G;
            for (let j in _) {
                const T = uo(_[j], M, A, I, H);
                T != null && ((G ?? (G = {}))[j] = T)
            }
            _ = G
        } else _ = uo(s[V], e, n, o, r);
        s[V] = _, _ != null && (c = V + 1)
    }
    return c < f && (s.length = c), n && ((t = Co(t)) && (s[As] = Bt(t)), n(i, s)), s
}

function u2(t) {
    return uo(t, qo, void 0, void 0, !1)
}

function qo(t) {
    switch (typeof t) {
        case "number":
            return Number.isFinite(t) ? t : "" + t;
        case "bigint":
            return ao(t) ? Number(t) : "" + t;
        case "boolean":
            return t ? 1 : 0;
        case "object":
            if (os(t)) return os(t) && ko(sl), xc(t);
            if (t.W === fr) return ml(t);
            if (t instanceof Sn) {
                const e = t.g;
                return e == null ? "" : typeof e == "string" ? e : t.g = xc(e)
            }
            return t instanceof _n ? t.La() : void 0
    }
    return t
}

function ml(t) {
    var e = t.u;
    t = hi(e, qo, void 0, void 0, !1);
    var n = 0 | e[le];
    if ((e = t.length) && !(512 & n)) {
        var s = t[e - 1],
            r = !1;
        ai(s) ? (e--, r = !0) : s = void 0;
        var i = e - (n = 512 & n ? 0 : -1),
            o = (pl ?? e2)(i, n, t, s);
        if (s && (t[e] = void 0), i < o && s) {
            for (var c in i = !0, s) {
                const f = +c;
                f <= o ? (t[r = f + n] = s[c], e = Math.max(r + 1, e), r = !1, delete s[c]) : i = !1
            }
            i && (s = void 0)
        }
        for (i = e - 1; e > 0; i = e - 1)
            if ((c = t[i]) == null) e--, r = !0;
            else {
                if (!((i -= n) >= o)) break;
                (s ?? (s = {}))[i] = c, e--, r = !0
            } r && (t.length = e), s && t.push(s)
    }
    return t
}

function Cn(t, e, n) {
    return t = yl(t, e[0], e[1], n ? 1 : 2), e !== gl && n && ii(t, 8192), t
}

function yl(t, e, n, s) {
    if (t == null) {
        var r = 96;
        n ? (t = [n], r |= 512) : t = [], e && (r = -16760833 & r | (1023 & e) << 14)
    } else {
        if (!Array.isArray(t)) throw Error("narr");
        if (8192 & (r = 0 | t[le]) || !(64 & r) || 2 & r || ko(Dh), 1024 & r) throw Error("farr");
        if (64 & r) return t;
        if (s === 1 || s === 2 || (r |= 64), n && (r |= 512, n !== t[0])) throw Error("mid");
        e: {
            var i = (n = t).length;
            if (i) {
                var o = i - 1;
                if (ai(s = n[o])) {
                    if ((o -= e = 512 & (r |= 256) ? 0 : -1) >= 1024) throw Error("pvtlmt");
                    for (var c in s) (i = +c) < o && (n[i + e] = s[c], delete s[c]);
                    r = -16760833 & r | (1023 & o) << 14;
                    break e
                }
            }
            if (e) {
                if ((c = Math.max(e, i - (512 & r ? 0 : -1))) > 1024) throw Error("spvt");
                r = -16760833 & r | (1023 & c) << 14
            }
        }
    }
    return Je(t, r), t
}

function lo(t, e, n = oo) {
    if (t != null) {
        if (Zu && t instanceof Uint8Array) return e ? t : new Uint8Array(t);
        if (Array.isArray(t)) {
            var s = 0 | t[le];
            return 2 & s ? t : (e && (e = s === 0 || !!(32 & s) && !(64 & s || !(16 & s))), e ? (Je(t, 34 | s), 4 & s && Object.freeze(t), t) : hi(t, lo, 4 & s ? oo : n, !0, !0))
        }
        return t.W === fr ? t = 2 & (s = 0 | (n = t.u)[le]) ? t : new t.constructor(di(n, s, !0)) : t instanceof _n && !(2 & t.M) && (n = Ns(t.da(lo)), t = new _n(n, t.I, t.S, t.X)), t
    }
}

function di(t, e, n) {
    const s = n || 2 & e ? oo : Gh,
        r = !!(32 & e);
    return t = function (i, o, c) {
        const f = Bt(i);
        var _ = f.length;
        const M = 256 & o ? f[_ - 1] : void 0;
        for (_ += M ? -1 : 0, o = 512 & o ? 1 : 0; o < _; o++) f[o] = c(f[o]);
        if (M) {
            o = f[o] = {};
            for (const A in M) o[A] = c(M[A])
        }
        return (i = Co(i)) && (f[As] = Bt(i)), f
    }(t, e, i => lo(i, r, s)), ii(t, 32 | (n ? 2 : 0)), t
}

function pi(t) {
    const e = t.u,
        n = 0 | e[le];
    return 2 & n ? new t.constructor(di(e, n, !1)) : t
}

function Ms(t, e) {
    return In(t = t.u, 0 | t[le], e)
}

function In(t, e, n) {
    if (n === -1) return null;
    const s = n + (512 & e ? 0 : -1),
        r = t.length - 1;
    return s >= r && 256 & e ? t[r][n] : s <= r ? t[s] : void 0
}

function Ne(t, e, n) {
    const s = t.u;
    let r = 0 | s[le];
    return Wn(r), qe(s, r, e, n), t
}

function qe(t, e, n, s) {
    const r = 512 & e ? 0 : -1,
        i = n + r;
    var o = t.length - 1;
    return i >= o && 256 & e ? (t[o][n] = s, e) : i <= o ? (t[i] = s, e) : (s !== void 0 && (n >= (o = e >> 14 & 1023 || 536870912) ? s != null && (t[o + r] = {
        [n]: s
    }, Je(t, e |= 256)) : t[i] = s), e)
}

function Nr(t, e) {
    let n = 0 | (t = t.u)[le];
    const s = In(t, n, e),
        r = Yn(s);
    return r != null && r !== s && qe(t, n, e, r), r
}

function _l(t) {
    let e = 0 | (t = t.u)[le];
    const n = In(t, e, 1),
        s = Fo(n, !0);
    return s != null && s !== n && qe(t, e, 1, s), s
}

function Qn() {
    return Vh === void 0 ? 2 : 4
}

function es(t, e, n, s, r) {
    const i = t.u,
        o = 2 & (t = 0 | i[le]) ? 1 : s;
    r = !!r;
    let c = 0 | (s = Wo(i, t, e))[le];
    if (!(4 & c)) {
        4 & c && (s = Bt(s), c = Mn(c, t), t = qe(i, t, e, s));
        let f = 0,
            _ = 0;
        for (; f < s.length; f++) {
            const M = n(s[f]);
            M != null && (s[_++] = M)
        }
        _ < f && (s.length = _), c = Yo(c, t), n = -2049 & (20 | c), c = n &= -4097, Je(s, c), 2 & c && Object.freeze(s)
    }
    return o === 1 || o === 4 && 32 & c ? An(c) || (r = c, c |= 2, c !== r && Je(s, c), Object.freeze(s)) : (o === 2 && An(c) && (s = Bt(s), c = Mn(c, t), c = Dn(c, t, r), Je(s, c), t = qe(i, t, e, s)), An(c) || (e = c, c = Dn(c, t, r), c !== e && Je(s, c))), s
}

function Wo(t, e, n) {
    return t = In(t, e, n), Array.isArray(t) ? t : Uo
}

function Yo(t, e) {
    return t === 0 && (t = Mn(t, e)), 1 | t
}

function An(t) {
    return !!(2 & t) && !!(4 & t) || !!(1024 & t)
}

function wl(t) {
    t = Bt(t);
    for (let e = 0; e < t.length; e++) {
        const n = t[e] = Bt(t[e]);
        Array.isArray(n[1]) && (n[1] = Ns(n[1]))
    }
    return t
}

function fo(t, e, n, s) {
    let r = 0 | (t = t.u)[le];
    Wn(r), qe(t, r, e, (s === "0" ? Number(n) === 0 : n === s) ? void 0 : n)
}

function Fs(t, e, n, s) {
    Wn(e);
    let r = Wo(t, e, n);
    const i = r !== Uo;
    if (64 & e || !(8192 & e) || !i) {
        const o = i ? 0 | r[le] : 0;
        let c = o;
        (!i || 2 & c || An(c) || 4 & c && !(32 & c)) && (r = Bt(r), c = Mn(c, e), e = qe(t, e, n, r)), c = -13 & Yo(c, e), c = Dn(s ? -17 & c : 16 | c, e, !0), c !== o && Je(r, c)
    }
    return r
}

function Vi(t, e) {
    var n = a1;
    return Xo($o(t = t.u), t, 0 | t[le], n) === e ? e : -1
}

function $o(t) {
    if (ri) return t[Hs] ?? (t[Hs] = new Map);
    if (Hs in t) return t[Hs];
    const e = new Map;
    return Object.defineProperty(t, Hs, {
        value: e
    }), e
}

function vl(t, e, n, s) {
    const r = $o(t),
        i = Xo(r, t, e, n);
    return i !== s && (i && (e = qe(t, e, i)), r.set(n, s)), e
}

function Xo(t, e, n, s) {
    let r = t.get(s);
    if (r != null) return r;
    r = 0;
    for (let i = 0; i < s.length; i++) {
        const o = s[i];
        In(e, n, o) != null && (r !== 0 && (n = qe(e, n, r)), r = o)
    }
    return t.set(s, r), r
}

function Ko(t, e, n) {
    let s = 0 | t[le];
    const r = In(t, s, n);
    let i;
    if (r != null && r.W === fr) return (e = pi(r)) !== r && qe(t, s, n, e), e.u;
    if (Array.isArray(r)) {
        const o = 0 | r[le];
        i = 2 & o ? Cn(di(r, o, !1), e, !0) : 64 & o ? r : Cn(i, e, !0)
    } else i = Cn(void 0, e, !0);
    return i !== r && qe(t, s, n, i), i
}

function bl(t, e, n) {
    let s = 0 | (t = t.u)[le];
    const r = In(t, s, n);
    return (e = Ho(r, e, !1, s)) !== r && e != null && qe(t, s, n, e), e
}

function Ee(t, e, n) {
    if ((e = bl(t, e, n)) == null) return e;
    let s = 0 | (t = t.u)[le];
    if (!(2 & s)) {
        const r = pi(e);
        r !== e && qe(t, s, n, e = r)
    }
    return e
}

function xl(t, e, n, s, r, i, o) {
    t = t.u;
    var c = !!(2 & e);
    const f = c ? 1 : r;
    i = !!i, o && (o = !c);
    var _ = 0 | (r = Wo(t, e, s))[le];
    if (!(c = !!(4 & _))) {
        var M = r,
            A = e;
        const I = !!(2 & (_ = Yo(_, e)));
        I && (A |= 2);
        let H = !I,
            V = !0,
            G = 0,
            j = 0;
        for (; G < M.length; G++) {
            const T = Ho(M[G], n, !1, A);
            if (T instanceof n) {
                if (!I) {
                    const Y = !!(2 & (0 | T.u[le]));
                    H && (H = !Y), V && (V = Y)
                }
                M[j++] = T
            }
        }
        j < G && (M.length = j), _ |= 4, _ = V ? 16 | _ : -17 & _, Je(M, _ = H ? 8 | _ : -9 & _), I && Object.freeze(M)
    }
    if (o && !(8 & _ || !r.length && (f === 1 || f === 4 && 32 & _))) {
        for (An(_) && (r = Bt(r), _ = Mn(_, e), e = qe(t, e, s, r)), n = r, o = _, M = 0; M < n.length; M++)(_ = n[M]) !== (A = pi(_)) && (n[M] = A);
        o |= 8, Je(n, o = n.length ? -17 & o : 16 | o), _ = o
    }
    return f === 1 || f === 4 && 32 & _ ? An(_) || (e = _, (_ |= !r.length || 16 & _ && (!c || 32 & _) ? 2 : 1024) !== e && Je(r, _), Object.freeze(r)) : (f === 2 && An(_) && (Je(r = Bt(r), _ = Dn(_ = Mn(_, e), e, i)), e = qe(t, e, s, r)), An(_) || (s = _, (_ = Dn(_, e, i)) !== s && Je(r, _))), r
}

function Pn(t, e, n) {
    const s = 0 | t.u[le];
    return xl(t, s, e, n, Qn(), !1, !(2 & s))
}

function pe(t, e, n, s) {
    return s == null && (s = void 0), Ne(t, n, s)
}

function Zs(t, e, n, s) {
    s == null && (s = void 0);
    e: {
        let r = 0 | (t = t.u)[le];
        if (Wn(r), s == null) {
            const i = $o(t);
            if (Xo(i, t, r, n) !== e) break e;
            i.set(n, 0)
        } else r = vl(t, r, n, e); qe(t, r, e, s)
    }
}

function Mn(t, e) {
    return -1025 & (t = 32 | (2 & e ? 2 | t : -3 & t))
}

function Dn(t, e, n) {
    return 32 & e && n || (t &= -33), t
}

function gi(t, e, n) {
    Wn(0 | t.u[le]), es(t, e, Ss, 2, !0).push(dl(n))
}

function $r(t, e, n, s) {
    const r = 0 | t.u[le];
    Wn(r), t = xl(t, r, n, e, 2, !0), s = s ?? new n, t.push(s), t[le] = 2 & (0 | s.u[le]) ? -9 & t[le] : -17 & t[le]
}

function Zt(t, e) {
    return ks(Ms(t, e))
}

function Qt(t, e) {
    return Ss(Ms(t, e))
}

function $e(t, e) {
    return Nr(t, e) ?? 0
}

function cr(t, e, n) {
    if (n != null && typeof n != "boolean") throw t = typeof n, Error(`Expected boolean but got ${t != "object" ? t : n ? Array.isArray(n) ? "array" : t : "null"}: ${n}`);
    Ne(t, e, n)
}

function wn(t, e, n) {
    if (n != null) {
        if (typeof n != "number" || !fi(n)) throw io("int32");
        n |= 0
    }
    Ne(t, e, n)
}

function ae(t, e, n) {
    if (n != null && typeof n != "number") throw Error(`Value of float/double field must be a number, found ${typeof n}: ${n}`);
    Ne(t, e, n)
}

function Xr(t, e, n) {
    {
        const o = t.u;
        let c = 0 | o[le];
        if (Wn(c), n == null) qe(o, c, e);
        else {
            var s = t = 0 | n[le],
                r = An(t),
                i = r || Object.isFrozen(n);
            for (r || (t = 0), i || (n = Bt(n), s = 0, t = Dn(t = Mn(t, c), c, !0), i = !1), t |= 21, r = 0; r < n.length; r++) {
                const f = n[r],
                    _ = dl(f);
                Object.is(f, _) || (i && (n = Bt(n), s = 0, t = Dn(t = Mn(t, c), c, !0), i = !1), n[r] = _)
            }
            t !== s && (i && (n = Bt(n), t = Dn(t = Mn(t, c), c, !0)), Je(n, t)), qe(o, c, e, n)
        }
    }
}

function El(t, e) {
    return Error(`Invalid wire type: ${t} (at position ${e})`)
}

function Jo() {
    return Error("Failed to read varint, encoding is invalid.")
}

function Al(t, e) {
    return Error(`Tried to read past the end of the data ${e} > ${t}`)
}

function Zo(t) {
    if (typeof t == "string") return {
        buffer: el(t),
        O: !1
    };
    if (Array.isArray(t)) return {
        buffer: new Uint8Array(t),
        O: !1
    };
    if (t.constructor === Uint8Array) return {
        buffer: t,
        O: !1
    };
    if (t.constructor === ArrayBuffer) return {
        buffer: new Uint8Array(t),
        O: !1
    };
    if (t.constructor === Sn) return {
        buffer: No(t) || new Uint8Array(0),
        O: !0
    };
    if (t instanceof Uint8Array) return {
        buffer: new Uint8Array(t.buffer, t.byteOffset, t.byteLength),
        O: !1
    };
    throw Error("Type not convertible to a Uint8Array, expected a Uint8Array, an ArrayBuffer, a base64 encoded string, a ByteString or an Array of numbers")
}

function Qo(t, e) {
    let n, s = 0,
        r = 0,
        i = 0;
    const o = t.h;
    let c = t.g;
    do n = o[c++], s |= (127 & n) << i, i += 7; while (i < 32 && 128 & n);
    for (i > 32 && (r |= (127 & n) >> 4), i = 3; i < 32 && 128 & n; i += 7) n = o[c++], r |= (127 & n) << i;
    if (ss(t, c), n < 128) return e(s >>> 0, r >>> 0);
    throw Jo()
}

function ea(t) {
    let e = 0,
        n = t.g;
    const s = n + 10,
        r = t.h;
    for (; n < s;) {
        const i = r[n++];
        if (e |= i, (128 & i) == 0) return ss(t, n), !!(127 & e)
    }
    throw Jo()
}

function zn(t) {
    const e = t.h;
    let n = t.g,
        s = e[n++],
        r = 127 & s;
    if (128 & s && (s = e[n++], r |= (127 & s) << 7, 128 & s && (s = e[n++], r |= (127 & s) << 14, 128 & s && (s = e[n++], r |= (127 & s) << 21, 128 & s && (s = e[n++], r |= s << 28, 128 & s && 128 & e[n++] && 128 & e[n++] && 128 & e[n++] && 128 & e[n++] && 128 & e[n++]))))) throw Jo();
    return ss(t, n), r
}

function Bn(t) {
    return zn(t) >>> 0
}

function ho(t) {
    var e = t.h;
    const n = t.g,
        s = e[n],
        r = e[n + 1],
        i = e[n + 2];
    return e = e[n + 3], ss(t, t.g + 4), (s << 0 | r << 8 | i << 16 | e << 24) >>> 0
}

function po(t) {
    var e = ho(t);
    t = 2 * (e >> 31) + 1;
    const n = e >>> 23 & 255;
    return e &= 8388607, n == 255 ? e ? NaN : t * (1 / 0) : n == 0 ? 1401298464324817e-60 * t * e : t * Math.pow(2, n - 150) * (e + 8388608)
}

function l2(t) {
    return zn(t)
}

function zi(t, e, {
    aa: n = !1
} = {}) {
    t.aa = n, e && (e = Zo(e), t.h = e.buffer, t.m = e.O, t.j = 0, t.l = t.h.length, t.g = t.j)
}

function ss(t, e) {
    if (t.g = e, e > t.l) throw Al(t.l, e)
}

function Tl(t, e) {
    if (e < 0) throw Error(`Tried to read a negative byte length: ${e}`);
    const n = t.g,
        s = n + e;
    if (s > t.l) throw Al(e, t.l - n);
    return t.g = s, n
}

function Sl(t, e) {
    if (e == 0) return as();
    var n = Tl(t, e);
    return t.aa && t.m ? n = t.h.subarray(n, n + e) : (t = t.h, n = n === (e = n + e) ? new Uint8Array(0) : $h ? t.slice(n, e) : new Uint8Array(t.subarray(n, e))), n.length == 0 ? as() : new Sn(n, Es)
}
_n.prototype.toJSON = void 0;
var Uc = [];

function Ml(t) {
    var e = t.g;
    if (e.g == e.l) return !1;
    t.l = t.g.g;
    var n = Bn(t.g);
    if (e = n >>> 3, !((n &= 7) >= 0 && n <= 5)) throw El(n, t.l);
    if (e < 1) throw Error(`Invalid field number: ${e} (at position ${t.l})`);
    return t.m = e, t.h = n, !0
}

function kr(t) {
    switch (t.h) {
        case 0:
            t.h != 0 ? kr(t) : ea(t.g);
            break;
        case 1:
            ss(t = t.g, t.g + 8);
            break;
        case 2:
            if (t.h != 2) kr(t);
            else {
                var e = Bn(t.g);
                ss(t = t.g, t.g + e)
            }
            break;
        case 5:
            ss(t = t.g, t.g + 4);
            break;
        case 3:
            for (e = t.m; ;) {
                if (!Ml(t)) throw Error("Unmatched start-group tag: stream EOF");
                if (t.h == 4) {
                    if (t.m != e) throw Error("Unmatched end-group tag");
                    break
                }
                kr(t)
            }
            break;
        default:
            throw El(t.h, t.l)
    }
}

function hr(t, e, n) {
    const s = t.g.l,
        r = Bn(t.g),
        i = t.g.g + r;
    let o = i - s;
    if (o <= 0 && (t.g.l = i, n(e, t, void 0, void 0, void 0), o = i - t.g.g), o) throw Error(`Message parsing ended unexpectedly. Expected to read ${r} bytes, instead read ${r - o} bytes, either the data ended unexpectedly or the message misreported its own length`);
    return t.g.g = i, t.g.l = s, e
}

function ta(t) {
    var e = Bn(t.g),
        n = Tl(t = t.g, e);
    if (t = t.h, Ph) {
        var s, r = t;
        (s = ki) || (s = ki = new TextDecoder("utf-8", {
            fatal: !0
        })), e = n + e, r = n === 0 && e === r.length ? r : r.subarray(n, e);
        try {
            var i = s.decode(r)
        } catch (c) {
            if (Rr === void 0) {
                try {
                    s.decode(new Uint8Array([128]))
                } catch { }
                try {
                    s.decode(new Uint8Array([97])), Rr = !0
                } catch {
                    Rr = !1
                }
            }
            throw !Rr && (ki = void 0), c
        }
    } else {
        e = (i = n) + e, n = [];
        let c, f = null;
        for (; i < e;) {
            var o = t[i++];
            o < 128 ? n.push(o) : o < 224 ? i >= e ? Xn() : (c = t[i++], o < 194 || (192 & c) != 128 ? (i--, Xn()) : n.push((31 & o) << 6 | 63 & c)) : o < 240 ? i >= e - 1 ? Xn() : (c = t[i++], (192 & c) != 128 || o === 224 && c < 160 || o === 237 && c >= 160 || (192 & (s = t[i++])) != 128 ? (i--, Xn()) : n.push((15 & o) << 12 | (63 & c) << 6 | 63 & s)) : o <= 244 ? i >= e - 2 ? Xn() : (c = t[i++], (192 & c) != 128 || c - 144 + (o << 28) >> 30 != 0 || (192 & (s = t[i++])) != 128 || (192 & (r = t[i++])) != 128 ? (i--, Xn()) : (o = (7 & o) << 18 | (63 & c) << 12 | (63 & s) << 6 | 63 & r, o -= 65536, n.push(55296 + (o >> 10 & 1023), 56320 + (1023 & o)))) : Xn(), n.length >= 8192 && (f = _c(f, n), n.length = 0)
        }
        i = _c(f, n)
    }
    return i
}

function Rl(t) {
    const e = Bn(t.g);
    return Sl(t.g, e)
}

function mi(t, e, n) {
    var s = Bn(t.g);
    for (s = t.g.g + s; t.g.g < s;) n.push(e(t.g))
}
var Pr = [];

function an(t, e, n) {
    e.g ? e.m(t, e.g, e.h, n) : e.m(t, e.h, n)
}
var oe = class {
    constructor(t, e) {
        this.u = yl(t, e)
    }
    toJSON() {
        try {
            var t = ml(this)
        } finally {
            pl = void 0
        }
        return t
    }
    l() {
        var t = W2;
        return t.g ? t.l(this, t.g, t.h) : t.l(this, t.h, t.defaultValue)
    }
    clone() {
        const t = this.u;
        return new this.constructor(di(t, 0 | t[le], !1))
    }
    O() {
        return !!(2 & (0 | this.u[le]))
    }
};

function Fc(t) {
    return t ? /^\d+$/.test(t) ? (li(t), new go(Le, We)) : null : f2 || (f2 = new go(0, 0))
}
oe.prototype.W = fr, oe.prototype.toString = function () {
    return this.u.toString()
};
var go = class {
    constructor(t, e) {
        this.h = t >>> 0, this.g = e >>> 0
    }
};
let f2;

function Cc(t) {
    return t ? /^-?\d+$/.test(t) ? (li(t), new mo(Le, We)) : null : h2 || (h2 = new mo(0, 0))
}
var mo = class {
    constructor(t, e) {
        this.h = t >>> 0, this.g = e >>> 0
    }
};
let h2;

function ws(t, e, n) {
    for (; n > 0 || e > 127;) t.g.push(127 & e | 128), e = (e >>> 7 | n << 25) >>> 0, n >>>= 7;
    t.g.push(e)
}

function Cs(t, e) {
    for (; e > 127;) t.g.push(127 & e | 128), e >>>= 7;
    t.g.push(e)
}

function yi(t, e) {
    if (e >= 0) Cs(t, e);
    else {
        for (let n = 0; n < 9; n++) t.g.push(127 & e | 128), e >>= 7;
        t.g.push(1)
    }
}

function ur(t, e) {
    t.g.push(e >>> 0 & 255), t.g.push(e >>> 8 & 255), t.g.push(e >>> 16 & 255), t.g.push(e >>> 24 & 255)
}

function Rs(t, e) {
    e.length !== 0 && (t.l.push(e), t.h += e.length)
}

function Ht(t, e, n) {
    Cs(t.g, 8 * e + n)
}

function na(t, e) {
    return Ht(t, e, 2), e = t.g.end(), Rs(t, e), e.push(t.h), e
}

function sa(t, e) {
    var n = e.pop();
    for (n = t.h + t.g.length() - n; n > 127;) e.push(127 & n | 128), n >>>= 7, t.h++;
    e.push(n), t.h++
}

function _i(t, e, n) {
    Ht(t, e, 2), Cs(t.g, n.length), Rs(t, t.g.end()), Rs(t, n)
}

function Kr(t, e, n, s) {
    n != null && (e = na(t, e), s(n, t), sa(t, e))
}

function cn() {
    const t = class {
        constructor() {
            throw Error()
        }
    };
    return Object.setPrototypeOf(t, t.prototype), t
}
var ra = cn(),
    Pl = cn(),
    ia = cn(),
    oa = cn(),
    Bl = cn(),
    Il = cn(),
    aa = cn(),
    Ol = cn(),
    Ll = cn(),
    Ds = class {
        constructor(t, e, n) {
            this.g = t, this.h = e, t = ra, this.l = !!t && n === t || !1
        }
    };

function wi(t, e) {
    return new Ds(t, e, ra)
}

function Nl(t, e, n, s, r) {
    Kr(t, n, Cl(e, s), r)
}
const d2 = wi(function (t, e, n, s, r) {
    return t.h === 2 && (hr(t, Ko(e, s, n), r), !0)
}, Nl),
    p2 = wi(function (t, e, n, s, r) {
        return t.h === 2 && (hr(t, Ko(e, s, n), r), !0)
    }, Nl);
var vi = Symbol(),
    ca = Symbol(),
    Dc = Symbol(),
    Gc = Symbol();
let kl, Ul;

function fs(t, e, n, s) {
    var r = s[t];
    if (r) return r;
    (r = {}).Ma = s, r.T = function (A) {
        switch (typeof A) {
            case "boolean":
                return gl || (gl = [0, void 0, !0]);
            case "number":
                return A > 0 ? void 0 : A === 0 ? c2 || (c2 = [0, void 0]) : [-A, void 0];
            case "string":
                return [0, A];
            case "object":
                return A
        }
    }(s[0]);
    var i = s[1];
    let o = 1;
    i && i.constructor === Object && (r.ga = i, typeof (i = s[++o]) == "function" && (r.la = !0, kl ?? (kl = i), Ul ?? (Ul = s[o + 1]), i = s[o += 2]));
    const c = {};
    for (; i && Array.isArray(i) && i.length && typeof i[0] == "number" && i[0] > 0;) {
        for (var f = 0; f < i.length; f++) c[i[f]] = i;
        i = s[++o]
    }
    for (f = 1; i !== void 0;) {
        let A;
        typeof i == "number" && (f += i, i = s[++o]);
        var _ = void 0;
        if (i instanceof Ds ? A = i : (A = d2, o--), A == null ? void 0 : A.l) {
            i = s[++o], _ = s;
            var M = o;
            typeof i == "function" && (i = i(), _[M] = i), _ = i
        }
        for (M = f + 1, typeof (i = s[++o]) == "number" && i < 0 && (M -= i, i = s[++o]); f < M; f++) {
            const I = c[f];
            _ ? n(r, f, A, _, I) : e(r, f, A, I)
        }
    }
    return s[t] = r
}

function Fl(t) {
    return Array.isArray(t) ? t[0] instanceof Ds ? t : [p2, t] : [t, void 0]
}

function Cl(t, e) {
    return t instanceof oe ? t.u : Array.isArray(t) ? Cn(t, e, !1) : void 0
}

function ua(t, e, n, s) {
    const r = n.g;
    t[e] = s ? (i, o, c) => r(i, o, c, s) : r
}

function la(t, e, n, s, r) {
    const i = n.g;
    let o, c;
    t[e] = (f, _, M) => i(f, _, M, c || (c = fs(ca, ua, la, s).T), o || (o = fa(s)), r)
}

function fa(t) {
    let e = t[Dc];
    if (e != null) return e;
    const n = fs(ca, ua, la, t);
    return e = n.la ? (s, r) => kl(s, r, n) : (s, r) => {
        const i = 0 | s[le];
        for (; Ml(r) && r.h != 4;) {
            var o = r.m,
                c = n[o];
            if (c == null) {
                var f = n.ga;
                f && (f = f[o]) && (f = g2(f)) != null && (c = n[o] = f)
            }
            c != null && c(r, s, o) || (o = (c = r).l, kr(c), c.fa ? c = void 0 : (f = c.g.g - o, c.g.g = o, c = Sl(c.g, f)), o = s, c && ((f = o[As]) ? f.push(c) : o[As] = [c]))
        }
        return 8192 & i && Ns(s), !0
    }, t[Dc] = e
}

function g2(t) {
    const e = (t = Fl(t))[0].g;
    if (t = t[1]) {
        const n = fa(t),
            s = fs(ca, ua, la, t).T;
        return (r, i, o) => e(r, i, o, s, n)
    }
    return e
}

function bi(t, e, n) {
    t[e] = n.h
}

function xi(t, e, n, s) {
    let r, i;
    const o = n.h;
    t[e] = (c, f, _) => o(c, f, _, i || (i = fs(vi, bi, xi, s).T), r || (r = Dl(s)))
}

function Dl(t) {
    let e = t[Gc];
    if (!e) {
        const n = fs(vi, bi, xi, t);
        e = (s, r) => Gl(s, r, n), t[Gc] = e
    }
    return e
}

function Gl(t, e, n) {
    (function (s, r, i) {
        const o = 512 & r ? 0 : -1,
            c = s.length,
            f = c + ((r = 64 & r ? 256 & r : !!c && ai(s[c - 1])) ? -1 : 0);
        for (let _ = 0; _ < f; _++) i(_ - o, s[_]);
        if (r) {
            s = s[c - 1];
            for (const _ in s) !isNaN(_) && i(+_, s[_])
        }
    })(t, 0 | t[le] | (n.T[1] ? 512 : 0), (s, r) => {
        if (r != null) {
            var i = function (o, c) {
                var f = o[c];
                if (f) return f;
                if ((f = o.ga) && (f = f[c])) {
                    var _ = (f = Fl(f))[0].h;
                    if (f = f[1]) {
                        const M = Dl(f),
                            A = fs(vi, bi, xi, f).T;
                        f = o.la ? Ul(A, M) : (I, H, V) => _(I, H, V, A, M)
                    } else f = _;
                    return o[c] = f
                }
            }(n, s);
            i && i(e, r, s)
        }
    }), (t = Co(t)) && function (s, r) {
        Rs(s, s.g.end());
        for (let i = 0; i < r.length; i++) Rs(s, No(r[i]) || new Uint8Array(0))
    }(e, t)
}

function Gs(t, e) {
    if (Array.isArray(e)) {
        var n = 0 | e[le];
        if (4 & n) return e;
        for (var s = 0, r = 0; s < e.length; s++) {
            const i = t(e[s]);
            i != null && (e[r++] = i)
        }
        return r < s && (e.length = r), Je(e, -6145 & (5 | n)), 2 & n && Object.freeze(e), e
    }
}

function Tt(t, e, n) {
    return new Ds(t, e, n)
}

function Vs(t, e, n) {
    return new Ds(t, e, n)
}

function St(t, e, n) {
    qe(t, 0 | t[le], e, n)
}
var m2 = wi(function (t, e, n, s, r) {
    return t.h === 2 && (t = hr(t, Cn([void 0, void 0], s, !0), r), Wn(s = 0 | e[le]), (r = In(e, s, n)) instanceof _n ? (2 & r.M) != 0 ? ((r = r.da()).push(t), qe(e, s, n, r)) : r.Ja(t) : Array.isArray(r) ? (2 & (0 | r[le]) && qe(e, s, n, r = wl(r)), r.push(t)) : qe(e, s, n, [t]), !0)
}, function (t, e, n, s, r) {
    if (e instanceof _n) e.forEach((i, o) => {
        Kr(t, n, Cn([o, i], s, !1), r)
    });
    else if (Array.isArray(e))
        for (let i = 0; i < e.length; i++) {
            const o = e[i];
            Array.isArray(o) && Kr(t, n, Cn(o, s, !1), r)
        }
});

function Vl(t, e, n) {
    if (e = function (s) {
        if (s == null) return s;
        const r = typeof s;
        if (r === "bigint") return String(or(64, s));
        if (ar(s)) {
            if (r === "string") return hl(s);
            if (r === "number") return jo(s)
        }
    }(e), e != null && (typeof e == "string" && Cc(e), e != null)) switch (Ht(t, n, 0), typeof e) {
        case "number":
            t = t.g, cs(e), ws(t, Le, We);
            break;
        case "bigint":
            n = BigInt.asUintN(64, e), n = new mo(Number(n & BigInt(4294967295)), Number(n >> BigInt(32))), ws(t.g, n.h, n.g);
            break;
        default:
            n = Cc(e), ws(t.g, n.h, n.g)
    }
}

function zl(t, e, n) {
    (e = ks(e)) != null && e != null && (Ht(t, n, 0), yi(t.g, e))
}

function jl(t, e, n) {
    (e = cl(e)) != null && (Ht(t, n, 0), t.g.g.push(e ? 1 : 0))
}

function Hl(t, e, n) {
    (e = Ss(e)) != null && _i(t, n, Xu(e))
}

function ql(t, e, n, s, r) {
    Kr(t, n, Cl(e, s), r)
}

function Wl(t, e, n) {
    e == null || typeof e == "string" || e instanceof Sn || (os(e) ? os(e) && ko(sl) : e = void 0), e != null && _i(t, n, Zo(e).buffer)
}

function Yl(t, e, n) {
    return (t.h === 5 || t.h === 2) && (e = Fs(e, 0 | e[le], n, !1), t.h == 2 ? mi(t, po, e) : e.push(po(t.g)), !0)
}
var xn = Tt(function (t, e, n) {
    if (t.h !== 1) return !1;
    var s = t.g;
    t = ho(s);
    const r = ho(s);
    s = 2 * (r >> 31) + 1;
    const i = r >>> 20 & 2047;
    return t = 4294967296 * (1048575 & r) + t, St(e, n, i == 2047 ? t ? NaN : s * (1 / 0) : i == 0 ? 5e-324 * s * t : s * Math.pow(2, i - 1075) * (t + 4503599627370496)), !0
}, function (t, e, n) {
    (e = Yn(e)) != null && (Ht(t, n, 1), t = t.g, (n = ol || (ol = new DataView(new ArrayBuffer(8)))).setFloat64(0, +e, !0), Le = n.getUint32(0, !0), We = n.getUint32(4, !0), ur(t, Le), ur(t, We))
}, cn()),
    Ze = Tt(function (t, e, n) {
        return t.h === 5 && (St(e, n, po(t.g)), !0)
    }, function (t, e, n) {
        (e = Yn(e)) != null && (Ht(t, n, 5), t = t.g, Do(e), ur(t, Le))
    }, aa),
    y2 = Vs(Yl, function (t, e, n) {
        if ((e = Gs(Yn, e)) != null)
            for (let o = 0; o < e.length; o++) {
                var s = t,
                    r = n,
                    i = e[o];
                i != null && (Ht(s, r, 5), s = s.g, Do(i), ur(s, Le))
            }
    }, aa),
    ha = Vs(Yl, function (t, e, n) {
        if ((e = Gs(Yn, e)) != null && e.length) {
            Ht(t, n, 2), Cs(t.g, 4 * e.length);
            for (let s = 0; s < e.length; s++) n = t.g, Do(e[s]), ur(n, Le)
        }
    }, aa),
    jn = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, Qo(t.g, Vo)), !0)
    }, Vl, Il),
    ji = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, (t = Qo(t.g, Vo)) === 0 ? void 0 : t), !0)
    }, Vl, Il),
    _2 = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, Qo(t.g, Go)), !0)
    }, function (t, e, n) {
        if ((e = Zh(e)) != null && (typeof e == "string" && Fc(e), e != null)) switch (Ht(t, n, 0), typeof e) {
            case "number":
                t = t.g, cs(e), ws(t, Le, We);
                break;
            case "bigint":
                n = BigInt.asUintN(64, e), n = new go(Number(n & BigInt(4294967295)), Number(n >> BigInt(32))), ws(t.g, n.h, n.g);
                break;
            default:
                n = Fc(e), ws(t.g, n.h, n.g)
        }
    }, cn()),
    Ye = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, zn(t.g)), !0)
    }, zl, oa),
    Ei = Vs(function (t, e, n) {
        return (t.h === 0 || t.h === 2) && (e = Fs(e, 0 | e[le], n, !1), t.h == 2 ? mi(t, zn, e) : e.push(zn(t.g)), !0)
    }, function (t, e, n) {
        if ((e = Gs(ks, e)) != null && e.length) {
            n = na(t, n);
            for (let s = 0; s < e.length; s++) yi(t.g, e[s]);
            sa(t, n)
        }
    }, oa),
    _s = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, (t = zn(t.g)) === 0 ? void 0 : t), !0)
    }, zl, oa),
    Ve = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, ea(t.g)), !0)
    }, jl, Pl),
    vs = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, (t = ea(t.g)) === !1 ? void 0 : t), !0)
    }, jl, Pl),
    mt = Vs(function (t, e, n) {
        return t.h === 2 && (t = ta(t), Fs(e, 0 | e[le], n, !1).push(t), !0)
    }, function (t, e, n) {
        if ((e = Gs(Ss, e)) != null)
            for (let o = 0; o < e.length; o++) {
                var s = t,
                    r = n,
                    i = e[o];
                i != null && _i(s, r, Xu(i))
            }
    }, ia),
    Nn = Tt(function (t, e, n) {
        return t.h === 2 && (St(e, n, (t = ta(t)) === "" ? void 0 : t), !0)
    }, Hl, ia),
    Be = Tt(function (t, e, n) {
        return t.h === 2 && (St(e, n, ta(t)), !0)
    }, Hl, ia),
    st = function (t, e, n = ra) {
        return new Ds(t, e, n)
    }(function (t, e, n, s, r) {
        return t.h === 2 && (s = Cn(void 0, s, !0), Fs(e, 0 | e[le], n, !0).push(s), hr(t, s, r), !0)
    }, function (t, e, n, s, r) {
        if (Array.isArray(e))
            for (let i = 0; i < e.length; i++) ql(t, e[i], n, s, r)
    }),
    Pe = wi(function (t, e, n, s, r, i) {
        return t.h === 2 && (vl(e, 0 | e[le], i, n), hr(t, e = Ko(e, s, n), r), !0)
    }, ql),
    $l = Tt(function (t, e, n) {
        return t.h === 2 && (St(e, n, Rl(t)), !0)
    }, Wl, Ol),
    w2 = Vs(function (t, e, n) {
        return (t.h === 0 || t.h === 2) && (e = Fs(e, 0 | e[le], n, !1), t.h == 2 ? mi(t, Bn, e) : e.push(Bn(t.g)), !0)
    }, function (t, e, n) {
        if ((e = Gs(ul, e)) != null)
            for (let o = 0; o < e.length; o++) {
                var s = t,
                    r = n,
                    i = e[o];
                i != null && (Ht(s, r, 0), Cs(s.g, i))
            }
    }, Bl),
    v2 = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, (t = Bn(t.g)) === 0 ? void 0 : t), !0)
    }, function (t, e, n) {
        (e = ul(e)) != null && e != null && (Ht(t, n, 0), Cs(t.g, e))
    }, Bl),
    Vt = Tt(function (t, e, n) {
        return t.h === 0 && (St(e, n, zn(t.g)), !0)
    }, function (t, e, n) {
        (e = ks(e)) != null && (e = parseInt(e, 10), Ht(t, n, 0), yi(t.g, e))
    }, Ll);
class b2 {
    constructor(e, n) {
        this.h = e, this.g = n, this.l = Ee, this.m = pe, this.defaultValue = void 0
    }
    register() {
        si(this)
    }
}

function un(t, e) {
    return new b2(t, e)
}

function $n(t, e) {
    return (n, s) => {
        if (Pr.length) {
            const i = Pr.pop();
            i.o(s), zi(i.g, n, s), n = i
        } else n = new class {
            constructor(i, o) {
                if (Uc.length) {
                    const c = Uc.pop();
                    zi(c, i, o), i = c
                } else i = new class {
                    constructor(c, f) {
                        this.h = null, this.m = !1, this.g = this.l = this.j = 0, zi(this, c, f)
                    }
                    clear() {
                        this.h = null, this.m = !1, this.g = this.l = this.j = 0, this.aa = !1
                    }
                }(i, o);
                this.g = i, this.l = this.g.g, this.h = this.m = -1, this.o(o)
            }
            o({
                fa: i = !1
            } = {}) {
                this.fa = i
            }
        }(n, s);
        try {
            const i = new t,
                o = i.u;
            fa(e)(o, n);
            var r = i
        } finally {
            n.g.clear(), n.m = -1, n.h = -1, Pr.length < 100 && Pr.push(n)
        }
        return r
    }
}

function Ai(t) {
    return function () {
        const e = new class {
            constructor() {
                this.l = [], this.h = 0, this.g = new class {
                    constructor() {
                        this.g = []
                    }
                    length() {
                        return this.g.length
                    }
                    end() {
                        const o = this.g;
                        return this.g = [], o
                    }
                }
            }
        };
        Gl(this.u, e, fs(vi, bi, xi, t)), Rs(e, e.g.end());
        const n = new Uint8Array(e.h),
            s = e.l,
            r = s.length;
        let i = 0;
        for (let o = 0; o < r; o++) {
            const c = s[o];
            n.set(c, i), i += c.length
        }
        return e.l = [n], n
    }
}
var Vc = class extends oe {
    constructor(t) {
        super(t)
    }
},
    zc = [0, Nn, Tt(function (t, e, n) {
        return t.h === 2 && (St(e, n, (t = Rl(t)) === as() ? void 0 : t), !0)
    }, function (t, e, n) {
        if (e != null) {
            if (e instanceof oe) {
                const s = e.Oa;
                return void (s && (e = s(e), e != null && _i(t, n, Zo(e).buffer)))
            }
            if (Array.isArray(e)) return
        }
        Wl(t, e, n)
    }, Ol)];
let Hi, jc = globalThis.trustedTypes;

function Hc(t) {
    Hi === void 0 && (Hi = function () {
        let n = null;
        if (!jc) return n;
        try {
            const s = r => r;
            n = jc.createPolicy("goog#html", {
                createHTML: s,
                createScript: s,
                createScriptURL: s
            })
        } catch { }
        return n
    }());
    var e = Hi;
    return new class {
        constructor(n) {
            this.g = n
        }
        toString() {
            return this.g + ""
        }
    }(e ? e.createScriptURL(t) : t)
}

function x2(t, ...e) {
    if (e.length === 0) return Hc(t[0]);
    let n = t[0];
    for (let s = 0; s < e.length; s++) n += encodeURIComponent(e[s]) + t[s + 1];
    return Hc(n)
}
var Xl = [0, Ye, Vt, Ve, -1, Ei, Vt, -1],
    E2 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Kl = [0, Ve, Be, Ve, Vt, -1, Vs(function (t, e, n) {
        return (t.h === 0 || t.h === 2) && (e = Fs(e, 0 | e[le], n, !1), t.h == 2 ? mi(t, l2, e) : e.push(zn(t.g)), !0)
    }, function (t, e, n) {
        if ((e = Gs(ks, e)) != null && e.length) {
            n = na(t, n);
            for (let s = 0; s < e.length; s++) yi(t.g, e[s]);
            sa(t, n)
        }
    }, Ll), Be, -1, [0, Ve, -1], Vt, Ve, -1],
    Jl = [0, Be, -2],
    qc = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Zl = [0],
    Ql = [0, Ye, Ve, 1, Ve, -3],
    jt = class extends oe {
        constructor(t) {
            super(t, 2)
        }
    },
    Qe = {};
Qe[336783863] = [0, Be, Ve, -1, Ye, [0, [1, 2, 3, 4, 5, 6, 7, 8, 9], Pe, Zl, Pe, Kl, Pe, Jl, Pe, Ql, Pe, Xl, Pe, [0, Be, -2], Pe, [0, Be, Vt], Pe, [0, Vt, Be, -1], Pe, [0, Vt, -1]],
    [0, Be], Ve, [0, [1, 3],
        [2, 4], Pe, [0, Ei], -1, Pe, [0, mt], -1, st, [0, Be, -1]
    ], Be
];
var Wc = [0, ji, -1, vs, -3, ji, Ei, Nn, _s, ji, -1, vs, _s, vs, -2, Nn];

function qt(t, e) {
    fo(t, 2, Us(e), "")
}

function Ue(t, e) {
    gi(t, 3, e)
}

function xe(t, e) {
    gi(t, 4, e)
}
var Et = class extends oe {
    constructor(t) {
        super(t, 500)
    }
    o(t) {
        return pe(this, 0, 7, t)
    }
},
    Qs = [-1, {}],
    Yc = [0, Be, 1, Qs],
    $c = [0, Be, mt, Qs];

function Wt(t, e) {
    $r(t, 1, Et, e)
}

function Ce(t, e) {
    gi(t, 10, e)
}

function Se(t, e) {
    gi(t, 15, e)
}
var Ot = class extends oe {
    constructor(t) {
        super(t, 500)
    }
    o(t) {
        return pe(this, 0, 1001, t)
    }
},
    e1 = [-500, st, [-500, Nn, -1, mt, -3, [-2, Qe, Ve], st, zc, _s, -1, Yc, $c, st, [0, Nn, vs], Nn, Wc, _s, mt, 987, mt], 4, st, [-500, Be, -1, [-1, {}], 998, Be], st, [-500, Be, mt, -1, [-2, {}, Ve], 997, mt, -1], _s, st, [-500, Be, mt, Qs, 998, mt], mt, _s, Yc, $c, st, [0, Nn, -1, Qs], mt, -2, Wc, Nn, -1, vs, [0, vs, v2], 978, Qs, st, zc];
Ot.prototype.g = Ai(e1);
var A2 = $n(Ot, e1),
    T2 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    t1 = class extends oe {
        constructor(t) {
            super(t)
        }
        g() {
            return Pn(this, T2, 1)
        }
    },
    n1 = [0, st, [0, Ye, Ze, Be, -1]],
    Ti = $n(t1, n1),
    S2 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    M2 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    qi = class extends oe {
        constructor(t) {
            super(t)
        }
        h() {
            return Ee(this, S2, 2)
        }
        g() {
            return Pn(this, M2, 5)
        }
    },
    s1 = $n(class extends oe {
        constructor(t) {
            super(t)
        }
    }, [0, mt, Ei, ha, [0, Vt, [0, Ye, -3],
        [0, Ze, -3],
        [0, Ye, -1, [0, st, [0, Ye, -2]]], st, [0, Ze, -1, Be, Ze]
    ], Be, -1, jn, st, [0, Ye, Ze], mt, jn]),
    r1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    bs = $n(class extends oe {
        constructor(t) {
            super(t)
        }
    }, [0, st, [0, Ze, -4]]),
    i1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    dr = $n(class extends oe {
        constructor(t) {
            super(t)
        }
    }, [0, st, [0, Ze, -4]]),
    R2 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    P2 = [0, Ye, -1, ha, Vt],
    o1 = class extends oe {
        constructor(t) {
            super(t)
        }
    };
o1.prototype.g = Ai([0, Ze, -4, jn]);
var B2 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    I2 = $n(class extends oe {
        constructor(t) {
            super(t)
        }
    }, [0, st, [0, 1, Ye, Be, n1], jn]),
    Xc = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    O2 = class extends oe {
        constructor(t) {
            super(t)
        }
        ma() {
            const t = _l(this);
            return t ?? as()
        }
    },
    L2 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    a1 = [1, 2],
    N2 = $n(class extends oe {
        constructor(t) {
            super(t)
        }
    }, [0, st, [0, a1, Pe, [0, ha], Pe, [0, $l], Ye, Be], jn]),
    da = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    c1 = [0, Be, Ye, Ze, mt, -1],
    Kc = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    k2 = [0, Ve, -1],
    Jc = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Ur = [1, 2, 3, 4, 5],
    Jr = class extends oe {
        constructor(t) {
            super(t)
        }
        g() {
            return _l(this) != null
        }
        h() {
            return Qt(this, 2) != null
        }
    },
    ze = class extends oe {
        constructor(t) {
            super(t)
        }
        g() {
            return cl(Ms(this, 2)) ?? !1
        }
    },
    u1 = [0, $l, Be, [0, Ye, jn, -1],
        [0, _2, jn]
    ],
    Xe = [0, u1, Ve, [0, Ur, Pe, Ql, Pe, Kl, Pe, Xl, Pe, Zl, Pe, Jl], Vt],
    Si = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    pa = [0, Xe, Ze, -1, Ye],
    U2 = un(502141897, Si);
Qe[502141897] = pa;
var F2 = $n(class extends oe {
    constructor(t) {
        super(t)
    }
}, [0, [0, Vt, -1, y2, w2], P2]),
    l1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    f1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    ga = [0, Xe, Ze, [0, Xe], Ve],
    h1 = [0, Xe, pa, ga, Ze, [0, [0, u1]]],
    C2 = un(508968150, f1);
Qe[508968150] = h1, Qe[508968149] = ga;
var d1 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    D2 = un(513916220, d1);
Qe[513916220] = [0, Xe, h1, Ye];
var hs = class extends oe {
    constructor(t) {
        super(t)
    }
    h() {
        return Ee(this, da, 2)
    }
    g() {
        Ne(this, 2)
    }
},
    p1 = [0, Xe, c1];
Qe[478825465] = p1;
var G2 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    g1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    ma = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    ya = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    m1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Zc = [0, Xe, [0, Xe], p1, -1],
    y1 = [0, Xe, Ze, Ye],
    _a = [0, Xe, Ze],
    _1 = [0, Xe, y1, _a, Ze],
    V2 = un(479097054, m1);
Qe[479097054] = [0, Xe, _1, Zc], Qe[463370452] = Zc, Qe[464864288] = y1;
var z2 = un(462713202, ya);
Qe[462713202] = _1, Qe[474472470] = _a;
var j2 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    w1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    v1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    b1 = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    wa = [0, Xe, Ze, -1, Ye],
    yo = [0, Xe, Ze, Ve];
b1.prototype.g = Ai([0, Xe, _a, [0, Xe], pa, ga, wa, yo]);
var x1 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    H2 = un(456383383, x1);
Qe[456383383] = [0, Xe, c1];
var E1 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    q2 = un(476348187, E1);
Qe[476348187] = [0, Xe, k2];
var A1 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    Qc = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    T1 = [0, Vt, -1],
    W2 = un(458105876, class extends oe {
        constructor(t) {
            super(t)
        }
        g() {
            var t = this.u;
            const e = 0 | t[le],
                n = 2 & e;
            return t = function (s, r, i) {
                var o = Qc;
                const c = 2 & r;
                let f = !1;
                if (i == null) {
                    if (c) return kc();
                    i = []
                } else if (i.constructor === _n) {
                    if ((2 & i.M) == 0 || c) return i;
                    i = i.da()
                } else Array.isArray(i) ? f = !!(2 & (0 | i[le])) : i = [];
                if (c) {
                    if (!i.length) return kc();
                    f || (f = !0, Ns(i))
                } else f && (f = !1, i = wl(i));
                return f || (64 & (0 | i[le]) ? i[le] &= -33 : 32 & r && ii(i, 32)), qe(s, r, 2, o = new _n(i, o, Qh, void 0)), o
            }(t, e, In(t, e, 2)), !n && Qc && (t.pa = !0), t
        }
    });
Qe[458105876] = [0, T1, m2, [!0, jn, [0, Be, -1, mt]]];
var va = class extends oe {
    constructor(t) {
        super(t)
    }
},
    S1 = un(458105758, va);
Qe[458105758] = [0, Xe, Be, T1];
var M1 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    Y2 = un(443442058, M1);
Qe[443442058] = [0, Xe, Be, Ye, Ze, mt, -1, Ve, Ze], Qe[514774813] = wa;
var R1 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    $2 = un(516587230, R1);

function _o(t, e) {
    return e = e ? e.clone() : new da, t.displayNamesLocale !== void 0 ? Ne(e, 1, Us(t.displayNamesLocale)) : t.displayNamesLocale === void 0 && Ne(e, 1), t.maxResults !== void 0 ? wn(e, 2, t.maxResults) : "maxResults" in t && Ne(e, 2), t.scoreThreshold !== void 0 ? ae(e, 3, t.scoreThreshold) : "scoreThreshold" in t && Ne(e, 3), t.categoryAllowlist !== void 0 ? Xr(e, 4, t.categoryAllowlist) : "categoryAllowlist" in t && Ne(e, 4), t.categoryDenylist !== void 0 ? Xr(e, 5, t.categoryDenylist) : "categoryDenylist" in t && Ne(e, 5), e
}

function ba(t, e = -1, n = "") {
    return {
        categories: t.map(s => ({
            index: Zt(s, 1) ?? 0 ?? -1,
            score: $e(s, 2) ?? 0,
            categoryName: Qt(s, 3) ?? "" ?? "",
            displayName: Qt(s, 4) ?? "" ?? ""
        })),
        headIndex: e,
        headName: n
    }
}

function P1(t) {
    var o, c;
    var e = es(t, 3, Yn, Qn()),
        n = es(t, 2, ks, Qn()),
        s = es(t, 1, Ss, Qn()),
        r = es(t, 9, Ss, Qn());
    const i = {
        categories: [],
        keypoints: []
    };
    for (let f = 0; f < e.length; f++) i.categories.push({
        score: e[f],
        index: n[f] ?? -1,
        categoryName: s[f] ?? "",
        displayName: r[f] ?? ""
    });
    if ((e = (o = Ee(t, qi, 4)) == null ? void 0 : o.h()) && (i.boundingBox = {
        originX: Zt(e, 1) ?? 0,
        originY: Zt(e, 2) ?? 0,
        width: Zt(e, 3) ?? 0,
        height: Zt(e, 4) ?? 0,
        angle: 0
    }), (c = Ee(t, qi, 4)) == null ? void 0 : c.g().length)
        for (const f of Ee(t, qi, 4).g()) i.keypoints.push({
            x: Nr(f, 1) ?? 0,
            y: Nr(f, 2) ?? 0,
            score: Nr(f, 4) ?? 0,
            label: Qt(f, 3) ?? ""
        });
    return i
}

function Mi(t) {
    const e = [];
    for (const n of Pn(t, i1, 1)) e.push({
        x: $e(n, 1) ?? 0,
        y: $e(n, 2) ?? 0,
        z: $e(n, 3) ?? 0,
        visibility: $e(n, 4) ?? 0
    });
    return e
}

function er(t) {
    const e = [];
    for (const n of Pn(t, r1, 1)) e.push({
        x: $e(n, 1) ?? 0,
        y: $e(n, 2) ?? 0,
        z: $e(n, 3) ?? 0,
        visibility: $e(n, 4) ?? 0
    });
    return e
}

function eu(t) {
    return Array.from(t, e => e > 127 ? e - 256 : e)
}

function tu(t, e) {
    if (t.length !== e.length) throw Error(`Cannot compute cosine similarity between embeddings of different sizes (${t.length} vs. ${e.length}).`);
    let n = 0,
        s = 0,
        r = 0;
    for (let i = 0; i < t.length; i++) n += t[i] * e[i], s += t[i] * t[i], r += e[i] * e[i];
    if (s <= 0 || r <= 0) throw Error("Cannot compute cosine similarity on embedding with 0 norm.");
    return n / Math.sqrt(s * r)
}
let Br;
Qe[516587230] = [0, Xe, wa, yo, Ze], Qe[518928384] = yo;
const X2 = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
async function B1() {
    if (Br === void 0) try {
        await WebAssembly.instantiate(X2), Br = !0
    } catch {
        Br = !1
    }
    return Br
}
async function qs(t, e = x2``) {
    const n = await B1() ? "wasm_internal" : "wasm_nosimd_internal";
    return {
        wasmLoaderPath: `${e}/${t}_${n}.js`,
        wasmBinaryPath: `${e}/${t}_${n}.wasm`
    }
}
var Kn = class { };

function I1() {
    var t = navigator;
    return typeof OffscreenCanvas < "u" && (! function (e = navigator) {
        return (e = e.userAgent).includes("Safari") && !e.includes("Chrome")
    }(t) || !!((t = t.userAgent.match(/Version\/([\d]+).*Safari/)) && t.length >= 1 && Number(t[1]) >= 17))
}
async function nu(t) {
    if (typeof importScripts != "function") {
        const e = document.createElement("script");
        console.log(['t, e, t.toString()', t, e, t.toString()]);
        return e.src = t.toString(), e.crossOrigin = "anonymous", new Promise((n, s) => {
            e.addEventListener("load", () => {
                n()
            }, !1), e.addEventListener("error", r => {
                s(r)
            }, !1), document.body.appendChild(e)
        })
    }
    importScripts(t.toString())
}

function O1(t) {
    return t.videoWidth !== void 0 ? [t.videoWidth, t.videoHeight] : t.naturalWidth !== void 0 ? [t.naturalWidth, t.naturalHeight] : t.displayWidth !== void 0 ? [t.displayWidth, t.displayHeight] : [t.width, t.height]
}

function ue(t, e, n) {
    t.m || console.error("No wasm multistream support detected: ensure dependency inclusion of :gl_graph_runner_internal_multi_input target"), n(e = t.i.stringToNewUTF8(e)), t.i._free(e)
}

function su(t, e, n) {
    if (!t.i.canvas) throw Error("No OpenGL canvas configured.");
    if (n ? t.i._bindTextureToStream(n) : t.i._bindTextureToCanvas(), !(n = t.i.canvas.getContext("webgl2") || t.i.canvas.getContext("webgl"))) throw Error("Failed to obtain WebGL context from the provided canvas. `getContext()` should only be invoked with `webgl` or `webgl2`.");
    t.i.gpuOriginForWebTexturesIsBottomLeft && n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL, !0), n.texImage2D(n.TEXTURE_2D, 0, n.RGBA, n.RGBA, n.UNSIGNED_BYTE, e), t.i.gpuOriginForWebTexturesIsBottomLeft && n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL, !1);
    const [s, r] = O1(e);
    return !t.l || s === t.i.canvas.width && r === t.i.canvas.height || (t.i.canvas.width = s, t.i.canvas.height = r), [s, r]
}

function ru(t, e, n) {
    t.m || console.error("No wasm multistream support detected: ensure dependency inclusion of :gl_graph_runner_internal_multi_input target");
    const s = new Uint32Array(e.length);
    for (let r = 0; r < e.length; r++) s[r] = t.i.stringToNewUTF8(e[r]);
    e = t.i._malloc(4 * s.length), t.i.HEAPU32.set(s, e >> 2), n(e);
    for (const r of s) t.i._free(r);
    t.i._free(e)
}

function hn(t, e, n) {
    t.i.simpleListeners = t.i.simpleListeners || {}, t.i.simpleListeners[e] = n
}

function On(t, e, n) {
    let s = [];
    t.i.simpleListeners = t.i.simpleListeners || {}, t.i.simpleListeners[e] = (r, i, o) => {
        i ? (n(s, o), s = []) : s.push(r)
    }
}
Kn.forVisionTasks = function (t) {
    return qs("vision", t)
}, Kn.forTextTasks = function (t) {
    return qs("text", t)
}, Kn.forGenAiExperimentalTasks = function (t) {
    return qs("genai_experimental", t)
}, Kn.forGenAiTasks = function (t) {
    return qs("genai", t)
}, Kn.forAudioTasks = function (t) {
    return qs("audio", t)
}, Kn.isSimdSupported = function () {
    return B1()
};
async function K2(t, e, n, s) {
    return t = await (async (r, i, o, c, f) => {
        if (i && await nu(i), !self.ModuleFactory || o && (await nu(o), !self.ModuleFactory)) throw Error("ModuleFactory not set.");
        return self.Module && f && ((i = self.Module).locateFile = f.locateFile, f.mainScriptUrlOrBlob && (i.mainScriptUrlOrBlob = f.mainScriptUrlOrBlob)), f = await self.ModuleFactory(self.Module || f), self.ModuleFactory = self.Module = void 0, new r(f, c)
    })(t, n.wasmLoaderPath, n.assetLoaderPath, e, {
        locateFile: r => r.endsWith(".wasm") ? n.wasmBinaryPath.toString() : n.assetBinaryPath && r.endsWith(".data") ? n.assetBinaryPath.toString() : r
    }), await t.o(s), t
}

function Wi(t, e) {
    const n = Ee(t.baseOptions, Jr, 1) || new Jr;
    typeof e == "string" ? (Ne(n, 2, Us(e)), Ne(n, 1)) : e instanceof Uint8Array && (Ne(n, 1, Fo(e, !1)), Ne(n, 2)), pe(t.baseOptions, 0, 1, n)
}

function iu(t) {
    try {
        const e = t.G.length;
        if (e === 1) throw Error(t.G[0].message);
        if (e > 1) throw Error("Encountered multiple errors: " + t.G.map(n => n.message).join(", "))
    } finally {
        t.G = []
    }
}

function re(t, e) {
    t.B = Math.max(t.B, e)
}

function Ri(t, e) {
    t.A = new Et, qt(t.A, "PassThroughCalculator"), Ue(t.A, "free_memory"), xe(t.A, "free_memory_unused_out"), Ce(e, "free_memory"), Wt(e, t.A)
}

function Ps(t, e) {
    Ue(t.A, e), xe(t.A, e + "_unused_out")
}

function Pi(t) {
    t.g.addBoolToStream(!0, "free_memory", t.B)
}
var wo = class {
    constructor(t) {
        this.g = t, this.G = [], this.B = 0, this.g.setAutoRenderToScreen(!1)
    }
    l(t, e = !0) {
        var n, s, r, i, o, c;
        if (e) {
            const f = t.baseOptions || {};
            if ((n = t.baseOptions) != null && n.modelAssetBuffer && ((s = t.baseOptions) != null && s.modelAssetPath)) throw Error("Cannot set both baseOptions.modelAssetPath and baseOptions.modelAssetBuffer");
            if (!((r = Ee(this.baseOptions, Jr, 1)) != null && r.g() || (i = Ee(this.baseOptions, Jr, 1)) != null && i.h() || (o = t.baseOptions) != null && o.modelAssetBuffer || (c = t.baseOptions) != null && c.modelAssetPath)) throw Error("Either baseOptions.modelAssetPath or baseOptions.modelAssetBuffer must be set");
            if (function (_, M) {
                let A = Ee(_.baseOptions, Jc, 3);
                if (!A) {
                    var I = A = new Jc,
                        H = new qc;
                    Zs(I, 4, Ur, H)
                }
                "delegate" in M && (M.delegate === "GPU" ? (M = A, I = new E2, Zs(M, 2, Ur, I)) : (M = A, I = new qc, Zs(M, 4, Ur, I))), pe(_.baseOptions, 0, 3, A)
            }(this, f), f.modelAssetPath) return fetch(f.modelAssetPath.toString()).then(_ => {
                if (_.ok) return _.arrayBuffer();
                throw Error(`Failed to fetch model: ${f.modelAssetPath} (${_.status})`)
            }).then(_ => {
                try {
                    this.g.i.FS_unlink("/model.dat")
                } catch { }
                this.g.i.FS_createDataFile("/", "model.dat", new Uint8Array(_), !0, !1, !1), Wi(this, "/model.dat"), this.m(), this.J()
            });
            if (f.modelAssetBuffer instanceof Uint8Array) Wi(this, f.modelAssetBuffer);
            else if (f.modelAssetBuffer) return async function (_) {
                const M = [];
                for (var A = 0; ;) {
                    const {
                        done: I,
                        value: H
                    } = await _.read();
                    if (I) break;
                    M.push(H), A += H.length
                }
                if (M.length === 0) return new Uint8Array(0);
                if (M.length === 1) return M[0];
                _ = new Uint8Array(A), A = 0;
                for (const I of M) _.set(I, A), A += I.length;
                return _
            }(f.modelAssetBuffer).then(_ => {
                Wi(this, _), this.m(), this.J()
            })
        }
        return this.m(), this.J(), Promise.resolve()
    }
    J() { }
    ca() {
        let t;
        if (this.g.ca(e => {
            t = A2(e)
        }), !t) throw Error("Failed to retrieve CalculatorGraphConfig");
        return t
    }
    setGraph(t, e) {
        this.g.attachErrorListener((n, s) => {
            this.G.push(Error(s))
        }), this.g.Ha(), this.g.setGraph(t, e), this.A = void 0, iu(this)
    }
    finishProcessing() {
        this.g.finishProcessing(), iu(this)
    }
    close() {
        this.A = void 0, this.g.closeGraph()
    }
};

function Rn(t, e) {
    if (!t) throw Error(`Unable to obtain required WebGL resource: ${e}`);
    return t
}
wo.prototype.close = wo.prototype.close;
class J2 {
    constructor(e, n, s, r) {
        this.g = e, this.h = n, this.m = s, this.l = r
    }
    bind() {
        this.g.bindVertexArray(this.h)
    }
    close() {
        this.g.deleteVertexArray(this.h), this.g.deleteBuffer(this.m), this.g.deleteBuffer(this.l)
    }
}

function ou(t, e, n) {
    const s = t.g;
    if (n = Rn(s.createShader(n), "Failed to create WebGL shader"), s.shaderSource(n, e), s.compileShader(n), !s.getShaderParameter(n, s.COMPILE_STATUS)) throw Error(`Could not compile WebGL shader: ${s.getShaderInfoLog(n)}`);
    return s.attachShader(t.h, n), n
}

function au(t, e) {
    const n = t.g,
        s = Rn(n.createVertexArray(), "Failed to create vertex array");
    n.bindVertexArray(s);
    const r = Rn(n.createBuffer(), "Failed to create buffer");
    n.bindBuffer(n.ARRAY_BUFFER, r), n.enableVertexAttribArray(t.P), n.vertexAttribPointer(t.P, 2, n.FLOAT, !1, 0, 0), n.bufferData(n.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), n.STATIC_DRAW);
    const i = Rn(n.createBuffer(), "Failed to create buffer");
    return n.bindBuffer(n.ARRAY_BUFFER, i), n.enableVertexAttribArray(t.J), n.vertexAttribPointer(t.J, 2, n.FLOAT, !1, 0, 0), n.bufferData(n.ARRAY_BUFFER, new Float32Array(e ? [0, 1, 0, 0, 1, 0, 1, 1] : [0, 0, 0, 1, 1, 1, 1, 0]), n.STATIC_DRAW), n.bindBuffer(n.ARRAY_BUFFER, null), n.bindVertexArray(null), new J2(n, s, r, i)
}

function xa(t, e) {
    if (t.g) {
        if (e !== t.g) throw Error("Cannot change GL context once initialized")
    } else t.g = e
}

function Ea(t, e, n, s) {
    return xa(t, e), t.h || (t.m(), t.C()), n ? (t.s || (t.s = au(t, !0)), n = t.s) : (t.v || (t.v = au(t, !1)), n = t.v), e.useProgram(t.h), n.bind(), t.l(), t = s(), n.g.bindVertexArray(null), t
}

function Bi(t, e, n) {
    return xa(t, e), t = Rn(e.createTexture(), "Failed to create texture"), e.bindTexture(e.TEXTURE_2D, t), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, n ?? e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, n ?? e.LINEAR), e.bindTexture(e.TEXTURE_2D, null), t
}

function Ii(t, e, n) {
    xa(t, e), t.A || (t.A = Rn(e.createFramebuffer(), "Failed to create framebuffe.")), e.bindFramebuffer(e.FRAMEBUFFER, t.A), e.framebufferTexture2D(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, n, 0)
}

function Aa(t) {
    var e;
    (e = t.g) == null || e.bindFramebuffer(t.g.FRAMEBUFFER, null)
}
var Ta = class {
    G() {
        return `
  precision mediump float;
  varying vec2 vTex;
  uniform sampler2D inputTexture;
  void main() {
    gl_FragColor = texture2D(inputTexture, vTex);
  }
 `
    }
    m() {
        const t = this.g;
        if (this.h = Rn(t.createProgram(), "Failed to create WebGL program"), this.Z = ou(this, `
  attribute vec2 aVertex;
  attribute vec2 aTex;
  varying vec2 vTex;
  void main(void) {
    gl_Position = vec4(aVertex, 0.0, 1.0);
    vTex = aTex;
  }`, t.VERTEX_SHADER), this.Y = ou(this, this.G(), t.FRAGMENT_SHADER), t.linkProgram(this.h), !t.getProgramParameter(this.h, t.LINK_STATUS)) throw Error(`Error during program linking: ${t.getProgramInfoLog(this.h)}`);
        this.P = t.getAttribLocation(this.h, "aVertex"), this.J = t.getAttribLocation(this.h, "aTex")
    }
    C() { }
    l() { }
    close() {
        if (this.h) {
            const t = this.g;
            t.deleteProgram(this.h), t.deleteShader(this.Z), t.deleteShader(this.Y)
        }
        this.A && this.g.deleteFramebuffer(this.A), this.v && this.v.close(), this.s && this.s.close()
    }
};

function En(t, e) {
    switch (e) {
        case 0:
            return t.g.find(n => n instanceof Uint8Array);
        case 1:
            return t.g.find(n => n instanceof Float32Array);
        case 2:
            return t.g.find(n => typeof WebGLTexture < "u" && n instanceof WebGLTexture);
        default:
            throw Error(`Type is not supported: ${e}`)
    }
}

function vo(t) {
    var e = En(t, 1);
    if (!e) {
        if (e = En(t, 0)) e = new Float32Array(e).map(s => s / 255);
        else {
            e = new Float32Array(t.width * t.height);
            const s = Bs(t);
            var n = Sa(t);
            if (Ii(n, s, L1(t)), "iPad Simulator;iPhone Simulator;iPod Simulator;iPad;iPhone;iPod".split(";").includes(navigator.platform) || navigator.userAgent.includes("Mac") && "document" in self && "ontouchend" in self.document) {
                n = new Float32Array(t.width * t.height * 4), s.readPixels(0, 0, t.width, t.height, s.RGBA, s.FLOAT, n);
                for (let r = 0, i = 0; r < e.length; ++r, i += 4) e[r] = n[i]
            } else s.readPixels(0, 0, t.width, t.height, s.RED, s.FLOAT, e)
        }
        t.g.push(e)
    }
    return e
}

function L1(t) {
    let e = En(t, 2);
    if (!e) {
        const n = Bs(t);
        e = k1(t);
        const s = vo(t),
            r = N1(t);
        n.texImage2D(n.TEXTURE_2D, 0, r, t.width, t.height, 0, n.RED, n.FLOAT, s), bo(t)
    }
    return e
}

function Bs(t) {
    if (!t.canvas) throw Error("Conversion to different image formats require that a canvas is passed when initializing the image.");
    return t.h || (t.h = Rn(t.canvas.getContext("webgl2"), "You cannot use a canvas that is already bound to a different type of rendering context.")), t.h
}

function N1(t) {
    if (t = Bs(t), !Ir)
        if (t.getExtension("EXT_color_buffer_float") && t.getExtension("OES_texture_float_linear") && t.getExtension("EXT_float_blend")) Ir = t.R32F;
        else {
            if (!t.getExtension("EXT_color_buffer_half_float")) throw Error("GPU does not fully support 4-channel float32 or float16 formats");
            Ir = t.R16F
        } return Ir
}

function Sa(t) {
    return t.l || (t.l = new Ta), t.l
}

function k1(t) {
    const e = Bs(t);
    e.viewport(0, 0, t.width, t.height), e.activeTexture(e.TEXTURE0);
    let n = En(t, 2);
    return n || (n = Bi(Sa(t), e, t.m ? e.LINEAR : e.NEAREST), t.g.push(n), t.j = !0), e.bindTexture(e.TEXTURE_2D, n), n
}

function bo(t) {
    t.h.bindTexture(t.h.TEXTURE_2D, null)
}
var Ir, it = class {
    constructor(t, e, n, s, r, i, o) {
        this.g = t, this.m = e, this.j = n, this.canvas = s, this.l = r, this.width = i, this.height = o, this.j && --cu === 0 && console.error("You seem to be creating MPMask instances without invoking .close(). This leaks resources.")
    }
    Da() {
        return !!En(this, 0)
    }
    ja() {
        return !!En(this, 1)
    }
    R() {
        return !!En(this, 2)
    }
    ia() {
        return (e = En(t = this, 0)) || (e = vo(t), e = new Uint8Array(e.map(n => 255 * n)), t.g.push(e)), e;
        var t, e
    }
    ha() {
        return vo(this)
    }
    N() {
        return L1(this)
    }
    clone() {
        const t = [];
        for (const e of this.g) {
            let n;
            if (e instanceof Uint8Array) n = new Uint8Array(e);
            else if (e instanceof Float32Array) n = new Float32Array(e);
            else {
                if (!(e instanceof WebGLTexture)) throw Error(`Type is not supported: ${e}`); {
                    const s = Bs(this),
                        r = Sa(this);
                    s.activeTexture(s.TEXTURE1), n = Bi(r, s, this.m ? s.LINEAR : s.NEAREST), s.bindTexture(s.TEXTURE_2D, n);
                    const i = N1(this);
                    s.texImage2D(s.TEXTURE_2D, 0, i, this.width, this.height, 0, s.RED, s.FLOAT, null), s.bindTexture(s.TEXTURE_2D, null), Ii(r, s, n), Ea(r, s, !1, () => {
                        k1(this), s.clearColor(0, 0, 0, 0), s.clear(s.COLOR_BUFFER_BIT), s.drawArrays(s.TRIANGLE_FAN, 0, 4), bo(this)
                    }), Aa(r), bo(this)
                }
            }
            t.push(n)
        }
        return new it(t, this.m, this.R(), this.canvas, this.l, this.width, this.height)
    }
    close() {
        this.j && Bs(this).deleteTexture(En(this, 2)), cu = -1
    }
};
it.prototype.close = it.prototype.close, it.prototype.clone = it.prototype.clone, it.prototype.getAsWebGLTexture = it.prototype.N, it.prototype.getAsFloat32Array = it.prototype.ha, it.prototype.getAsUint8Array = it.prototype.ia, it.prototype.hasWebGLTexture = it.prototype.R, it.prototype.hasFloat32Array = it.prototype.ja, it.prototype.hasUint8Array = it.prototype.Da;
var cu = 250;

function mn(t, e) {
    switch (e) {
        case 0:
            return t.g.find(n => n instanceof ImageData);
        case 1:
            return t.g.find(n => typeof ImageBitmap < "u" && n instanceof ImageBitmap);
        case 2:
            return t.g.find(n => typeof WebGLTexture < "u" && n instanceof WebGLTexture);
        default:
            throw Error(`Type is not supported: ${e}`)
    }
}

function U1(t) {
    var e = mn(t, 0);
    if (!e) {
        e = Is(t);
        const n = Oi(t),
            s = new Uint8Array(t.width * t.height * 4);
        Ii(n, e, Fr(t)), e.readPixels(0, 0, t.width, t.height, e.RGBA, e.UNSIGNED_BYTE, s), Aa(n), e = new ImageData(new Uint8ClampedArray(s.buffer), t.width, t.height), t.g.push(e)
    }
    return e
}

function Fr(t) {
    let e = mn(t, 2);
    if (!e) {
        const n = Is(t);
        e = Cr(t);
        const s = mn(t, 1) || U1(t);
        n.texImage2D(n.TEXTURE_2D, 0, n.RGBA, n.RGBA, n.UNSIGNED_BYTE, s), $s(t)
    }
    return e
}

function Is(t) {
    if (!t.canvas) throw Error("Conversion to different image formats require that a canvas is passed when initializing the image.");
    return t.h || (t.h = Rn(t.canvas.getContext("webgl2"), "You cannot use a canvas that is already bound to a different type of rendering context.")), t.h
}

function Oi(t) {
    return t.l || (t.l = new Ta), t.l
}

function Cr(t) {
    const e = Is(t);
    e.viewport(0, 0, t.width, t.height), e.activeTexture(e.TEXTURE0);
    let n = mn(t, 2);
    return n || (n = Bi(Oi(t), e), t.g.push(n), t.m = !0), e.bindTexture(e.TEXTURE_2D, n), n
}

function $s(t) {
    t.h.bindTexture(t.h.TEXTURE_2D, null)
}

function uu(t) {
    const e = Is(t);
    return Ea(Oi(t), e, !0, () => function (n, s) {
        const r = n.canvas;
        if (r.width === n.width && r.height === n.height) return s();
        const i = r.width,
            o = r.height;
        return r.width = n.width, r.height = n.height, n = s(), r.width = i, r.height = o, n
    }(t, () => {
        if (e.bindFramebuffer(e.FRAMEBUFFER, null), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), e.drawArrays(e.TRIANGLE_FAN, 0, 4), !(t.canvas instanceof OffscreenCanvas)) throw Error("Conversion to ImageBitmap requires that the MediaPipe Tasks is initialized with an OffscreenCanvas");
        return t.canvas.transferToImageBitmap()
    }))
}
var ot = class {
    constructor(t, e, n, s, r, i, o) {
        this.g = t, this.j = e, this.m = n, this.canvas = s, this.l = r, this.width = i, this.height = o, (this.j || this.m) && --lu === 0 && console.error("You seem to be creating MPImage instances without invoking .close(). This leaks resources.")
    }
    Ca() {
        return !!mn(this, 0)
    }
    ka() {
        return !!mn(this, 1)
    }
    R() {
        return !!mn(this, 2)
    }
    Aa() {
        return U1(this)
    }
    za() {
        var t = mn(this, 1);
        return t || (Fr(this), Cr(this), t = uu(this), $s(this), this.g.push(t), this.j = !0), t
    }
    N() {
        return Fr(this)
    }
    clone() {
        const t = [];
        for (const e of this.g) {
            let n;
            if (e instanceof ImageData) n = new ImageData(e.data, this.width, this.height);
            else if (e instanceof WebGLTexture) {
                const s = Is(this),
                    r = Oi(this);
                s.activeTexture(s.TEXTURE1), n = Bi(r, s), s.bindTexture(s.TEXTURE_2D, n), s.texImage2D(s.TEXTURE_2D, 0, s.RGBA, this.width, this.height, 0, s.RGBA, s.UNSIGNED_BYTE, null), s.bindTexture(s.TEXTURE_2D, null), Ii(r, s, n), Ea(r, s, !1, () => {
                    Cr(this), s.clearColor(0, 0, 0, 0), s.clear(s.COLOR_BUFFER_BIT), s.drawArrays(s.TRIANGLE_FAN, 0, 4), $s(this)
                }), Aa(r), $s(this)
            } else {
                if (!(e instanceof ImageBitmap)) throw Error(`Type is not supported: ${e}`);
                Fr(this), Cr(this), n = uu(this), $s(this)
            }
            t.push(n)
        }
        return new ot(t, this.ka(), this.R(), this.canvas, this.l, this.width, this.height)
    }
    close() {
        this.j && mn(this, 1).close(), this.m && Is(this).deleteTexture(mn(this, 2)), lu = -1
    }
};
ot.prototype.close = ot.prototype.close, ot.prototype.clone = ot.prototype.clone, ot.prototype.getAsWebGLTexture = ot.prototype.N, ot.prototype.getAsImageBitmap = ot.prototype.za, ot.prototype.getAsImageData = ot.prototype.Aa, ot.prototype.hasWebGLTexture = ot.prototype.R, ot.prototype.hasImageBitmap = ot.prototype.ka, ot.prototype.hasImageData = ot.prototype.Ca;
var lu = 250;

function ln(...t) {
    return t.map(([e, n]) => ({
        start: e,
        end: n
    }))
}
const Z2 = function (t) {
    return class extends t {
        Ha() {
            this.i._registerModelResourcesGraphService()
        }
    }
}((
    fu = class {
    constructor(t, e) {
        this.l = !0, this.i = t, this.g = null, this.h = 0, this.m = typeof this.i._addIntToInputStream == "function", e !== void 0 ? this.i.canvas = e : I1() ? this.i.canvas = new OffscreenCanvas(1, 1) : (console.warn("OffscreenCanvas not supported and GraphRunner constructor glCanvas parameter is undefined. Creating backup canvas."), this.i.canvas = document.createElement("canvas"))
    }
    async initializeGraph(t) {
        const e = await (await fetch(t)).arrayBuffer();
        t = !(t.endsWith(".pbtxt") || t.endsWith(".textproto")), this.setGraph(new Uint8Array(e), t)
    }
    setGraphFromString(t) {
        this.setGraph(new TextEncoder().encode(t), !1)
    }
    setGraph(t, e) {
        const n = t.length,
            s = this.i._malloc(n);
        this.i.HEAPU8.set(t, s), e ? this.i._changeBinaryGraph(n, s) : this.i._changeTextGraph(n, s), this.i._free(s)
    }
    configureAudio(t, e, n, s, r) {
        this.i._configureAudio || console.warn('Attempting to use configureAudio without support for input audio. Is build dep ":gl_graph_runner_audio" missing?'), ue(this, s || "input_audio", i => {
            ue(this, r = r || "audio_header", o => {
                this.i._configureAudio(i, o, t, e ?? 0, n)
            })
        })
    }
    setAutoResizeCanvas(t) {
        this.l = t
    }
    setAutoRenderToScreen(t) {
        this.i._setAutoRenderToScreen(t)
    }
    setGpuBufferVerticalFlip(t) {
        this.i.gpuOriginForWebTexturesIsBottomLeft = t
    }
    ca(t) {
        hn(this, "__graph_config__", e => {
            t(e)
        }), ue(this, "__graph_config__", e => {
            this.i._getGraphConfig(e, void 0)
        }), delete this.i.simpleListeners.__graph_config__
    }
    attachErrorListener(t) {
        this.i.errorListener = t
    }
    attachEmptyPacketListener(t, e) {
        this.i.emptyPacketListeners = this.i.emptyPacketListeners || {}, this.i.emptyPacketListeners[t] = e
    }
    addAudioToStream(t, e, n) {
        this.addAudioToStreamWithShape(t, 0, 0, e, n)
    }
    addAudioToStreamWithShape(t, e, n, s, r) {
        const i = 4 * t.length;
        this.h !== i && (this.g && this.i._free(this.g), this.g = this.i._malloc(i), this.h = i), this.i.HEAPF32.set(t, this.g / 4), ue(this, s, o => {
            this.i._addAudioToInputStream(this.g, e, n, o, r)
        })
    }
    addGpuBufferToStream(t, e, n) {
        ue(this, e, s => {
            const [r, i] = su(this, t, s);
            this.i._addBoundTextureToStream(s, r, i, n)
        })
    }
    addBoolToStream(t, e, n) {
        ue(this, e, s => {
            this.i._addBoolToInputStream(t, s, n)
        })
    }
    addDoubleToStream(t, e, n) {
        ue(this, e, s => {
            this.i._addDoubleToInputStream(t, s, n)
        })
    }
    addFloatToStream(t, e, n) {
        ue(this, e, s => {
            this.i._addFloatToInputStream(t, s, n)
        })
    }
    addIntToStream(t, e, n) {
        ue(this, e, s => {
            this.i._addIntToInputStream(t, s, n)
        })
    }
    addUintToStream(t, e, n) {
        ue(this, e, s => {
            this.i._addUintToInputStream(t, s, n)
        })
    }
    addStringToStream(t, e, n) {
        ue(this, e, s => {
            ue(this, t, r => {
                this.i._addStringToInputStream(r, s, n)
            })
        })
    }
    addStringRecordToStream(t, e, n) {
        ue(this, e, s => {
            ru(this, Object.keys(t), r => {
                ru(this, Object.values(t), i => {
                    this.i._addFlatHashMapToInputStream(r, i, Object.keys(t).length, s, n)
                })
            })
        })
    }
    addProtoToStream(t, e, n, s) {
        ue(this, n, r => {
            ue(this, e, i => {
                const o = this.i._malloc(t.length);
                this.i.HEAPU8.set(t, o), this.i._addProtoToInputStream(o, t.length, i, r, s), this.i._free(o)
            })
        })
    }
    addEmptyPacketToStream(t, e) {
        ue(this, t, n => {
            this.i._addEmptyPacketToInputStream(n, e)
        })
    }
    addBoolVectorToStream(t, e, n) {
        ue(this, e, s => {
            const r = this.i._allocateBoolVector(t.length);
            if (!r) throw Error("Unable to allocate new bool vector on heap.");
            for (const i of t) this.i._addBoolVectorEntry(r, i);
            this.i._addBoolVectorToInputStream(r, s, n)
        })
    }
    addDoubleVectorToStream(t, e, n) {
        ue(this, e, s => {
            const r = this.i._allocateDoubleVector(t.length);
            if (!r) throw Error("Unable to allocate new double vector on heap.");
            for (const i of t) this.i._addDoubleVectorEntry(r, i);
            this.i._addDoubleVectorToInputStream(r, s, n)
        })
    }
    addFloatVectorToStream(t, e, n) {
        ue(this, e, s => {
            const r = this.i._allocateFloatVector(t.length);
            if (!r) throw Error("Unable to allocate new float vector on heap.");
            for (const i of t) this.i._addFloatVectorEntry(r, i);
            this.i._addFloatVectorToInputStream(r, s, n)
        })
    }
    addIntVectorToStream(t, e, n) {
        ue(this, e, s => {
            const r = this.i._allocateIntVector(t.length);
            if (!r) throw Error("Unable to allocate new int vector on heap.");
            for (const i of t) this.i._addIntVectorEntry(r, i);
            this.i._addIntVectorToInputStream(r, s, n)
        })
    }
    addUintVectorToStream(t, e, n) {
        ue(this, e, s => {
            const r = this.i._allocateUintVector(t.length);
            if (!r) throw Error("Unable to allocate new unsigned int vector on heap.");
            for (const i of t) this.i._addUintVectorEntry(r, i);
            this.i._addUintVectorToInputStream(r, s, n)
        })
    }
    addStringVectorToStream(t, e, n) {
        ue(this, e, s => {
            const r = this.i._allocateStringVector(t.length);
            if (!r) throw Error("Unable to allocate new string vector on heap.");
            for (const i of t) ue(this, i, o => {
                this.i._addStringVectorEntry(r, o)
            });
            this.i._addStringVectorToInputStream(r, s, n)
        })
    }
    addBoolToInputSidePacket(t, e) {
        ue(this, e, n => {
            this.i._addBoolToInputSidePacket(t, n)
        })
    }
    addDoubleToInputSidePacket(t, e) {
        ue(this, e, n => {
            this.i._addDoubleToInputSidePacket(t, n)
        })
    }
    addFloatToInputSidePacket(t, e) {
        ue(this, e, n => {
            this.i._addFloatToInputSidePacket(t, n)
        })
    }
    addIntToInputSidePacket(t, e) {
        ue(this, e, n => {
            this.i._addIntToInputSidePacket(t, n)
        })
    }
    addUintToInputSidePacket(t, e) {
        ue(this, e, n => {
            this.i._addUintToInputSidePacket(t, n)
        })
    }
    addStringToInputSidePacket(t, e) {
        ue(this, e, n => {
            ue(this, t, s => {
                this.i._addStringToInputSidePacket(s, n)
            })
        })
    }
    addProtoToInputSidePacket(t, e, n) {
        ue(this, n, s => {
            ue(this, e, r => {
                const i = this.i._malloc(t.length);
                this.i.HEAPU8.set(t, i), this.i._addProtoToInputSidePacket(i, t.length, r, s), this.i._free(i)
            })
        })
    }
    addBoolVectorToInputSidePacket(t, e) {
        ue(this, e, n => {
            const s = this.i._allocateBoolVector(t.length);
            if (!s) throw Error("Unable to allocate new bool vector on heap.");
            for (const r of t) this.i._addBoolVectorEntry(s, r);
            this.i._addBoolVectorToInputSidePacket(s, n)
        })
    }
    addDoubleVectorToInputSidePacket(t, e) {
        ue(this, e, n => {
            const s = this.i._allocateDoubleVector(t.length);
            if (!s) throw Error("Unable to allocate new double vector on heap.");
            for (const r of t) this.i._addDoubleVectorEntry(s, r);
            this.i._addDoubleVectorToInputSidePacket(s, n)
        })
    }
    addFloatVectorToInputSidePacket(t, e) {
        ue(this, e, n => {
            const s = this.i._allocateFloatVector(t.length);
            if (!s) throw Error("Unable to allocate new float vector on heap.");
            for (const r of t) this.i._addFloatVectorEntry(s, r);
            this.i._addFloatVectorToInputSidePacket(s, n)
        })
    }
    addIntVectorToInputSidePacket(t, e) {
        ue(this, e, n => {
            const s = this.i._allocateIntVector(t.length);
            if (!s) throw Error("Unable to allocate new int vector on heap.");
            for (const r of t) this.i._addIntVectorEntry(s, r);
            this.i._addIntVectorToInputSidePacket(s, n)
        })
    }
    addUintVectorToInputSidePacket(t, e) {
        ue(this, e, n => {
            const s = this.i._allocateUintVector(t.length);
            if (!s) throw Error("Unable to allocate new unsigned int vector on heap.");
            for (const r of t) this.i._addUintVectorEntry(s, r);
            this.i._addUintVectorToInputSidePacket(s, n)
        })
    }
    addStringVectorToInputSidePacket(t, e) {
        ue(this, e, n => {
            const s = this.i._allocateStringVector(t.length);
            if (!s) throw Error("Unable to allocate new string vector on heap.");
            for (const r of t) ue(this, r, i => {
                this.i._addStringVectorEntry(s, i)
            });
            this.i._addStringVectorToInputSidePacket(s, n)
        })
    }
    attachBoolListener(t, e) {
        hn(this, t, e), ue(this, t, n => {
            this.i._attachBoolListener(n)
        })
    }
    attachBoolVectorListener(t, e) {
        On(this, t, e), ue(this, t, n => {
            this.i._attachBoolVectorListener(n)
        })
    }
    attachIntListener(t, e) {
        hn(this, t, e), ue(this, t, n => {
            this.i._attachIntListener(n)
        })
    }
    attachIntVectorListener(t, e) {
        On(this, t, e), ue(this, t, n => {
            this.i._attachIntVectorListener(n)
        })
    }
    attachUintListener(t, e) {
        hn(this, t, e), ue(this, t, n => {
            this.i._attachUintListener(n)
        })
    }
    attachUintVectorListener(t, e) {
        On(this, t, e), ue(this, t, n => {
            this.i._attachUintVectorListener(n)
        })
    }
    attachDoubleListener(t, e) {
        hn(this, t, e), ue(this, t, n => {
            this.i._attachDoubleListener(n)
        })
    }
    attachDoubleVectorListener(t, e) {
        On(this, t, e), ue(this, t, n => {
            this.i._attachDoubleVectorListener(n)
        })
    }
    attachFloatListener(t, e) {
        hn(this, t, e), ue(this, t, n => {
            this.i._attachFloatListener(n)
        })
    }
    attachFloatVectorListener(t, e) {
        On(this, t, e), ue(this, t, n => {
            this.i._attachFloatVectorListener(n)
        })
    }
    attachStringListener(t, e) {
        hn(this, t, e), ue(this, t, n => {
            this.i._attachStringListener(n)
        })
    }
    attachStringVectorListener(t, e) {
        On(this, t, e), ue(this, t, n => {
            this.i._attachStringVectorListener(n)
        })
    }
    attachProtoListener(t, e, n) {
        hn(this, t, e), ue(this, t, s => {
            this.i._attachProtoListener(s, n || !1)
        })
    }
    attachProtoVectorListener(t, e, n) {
        On(this, t, e), ue(this, t, s => {
            this.i._attachProtoVectorListener(s, n || !1)
        })
    }
    attachAudioListener(t, e, n) {
        this.i._attachAudioListener || console.warn('Attempting to use attachAudioListener without support for output audio. Is build dep ":gl_graph_runner_audio_out" missing?'), hn(this, t, (s, r) => {
            s = new Float32Array(s.buffer, s.byteOffset, s.length / 4), e(s, r)
        }), ue(this, t, s => {
            this.i._attachAudioListener(s, n || !1)
        })
    }
    finishProcessing() {
        this.i._waitUntilIdle()
    }
    closeGraph() {
        this.i._closeGraph(), this.i.simpleListeners = void 0, this.i.emptyPacketListeners = void 0
    }
    },
    class extends fu {
        get ea() {
            return this.i
        }
        oa(t, e, n) {
            ue(this, e, s => {
                const [r, i] = su(this, t, s);
                this.ea._addBoundTextureAsImageToStream(s, r, i, n)
            })
        }
        V(t, e) {
            hn(this, t, e), ue(this, t, n => {
                this.ea._attachImageListener(n)
            })
        }
        ba(t, e) {
            On(this, t, e), ue(this, t, n => {
                this.ea._attachImageVectorListener(n)
            })
        }
    }));
var fu, en = class extends Z2 { };
async function be(t, e, n) {
    return async function (s, r, i, o) {
        return K2(s, r, i, o)
    }(t, n.canvas ?? (I1() ? void 0 : document.createElement("canvas")), e, n)
}

function F1(t, e, n, s) {
    if (t.U) {
        const i = new o1;
        if (n != null && n.regionOfInterest) {
            if (!t.na) throw Error("This task doesn't support region-of-interest.");
            var r = n.regionOfInterest;
            if (r.left >= r.right || r.top >= r.bottom) throw Error("Expected RectF with left < right and top < bottom.");
            if (r.left < 0 || r.top < 0 || r.right > 1 || r.bottom > 1) throw Error("Expected RectF values to be in [0,1].");
            ae(i, 1, (r.left + r.right) / 2), ae(i, 2, (r.top + r.bottom) / 2), ae(i, 4, r.right - r.left), ae(i, 3, r.bottom - r.top)
        } else ae(i, 1, .5), ae(i, 2, .5), ae(i, 4, 1), ae(i, 3, 1);
        if (n != null && n.rotationDegrees) {
            if ((n == null ? void 0 : n.rotationDegrees) % 90 != 0) throw Error("Expected rotation to be a multiple of 90°.");
            if (ae(i, 5, -Math.PI * n.rotationDegrees / 180), (n == null ? void 0 : n.rotationDegrees) % 180 != 0) {
                const [o, c] = O1(e);
                n = $e(i, 3) * c / o, r = $e(i, 4) * o / c, ae(i, 4, n), ae(i, 3, r)
            }
        }
        t.g.addProtoToStream(i.g(), "mediapipe.NormalizedRect", t.U, s)
    }
    t.g.oa(e, t.Z, s ?? performance.now()), t.finishProcessing()
}

function tn(t, e, n) {
    var s;
    if ((s = t.baseOptions) != null && s.g()) throw Error("Task is not initialized with image mode. 'runningMode' must be set to 'IMAGE'.");
    F1(t, e, n, t.B + 1)
}

function vn(t, e, n, s) {
    var r;
    if (!((r = t.baseOptions) != null && r.g())) throw Error("Task is not initialized with video mode. 'runningMode' must be set to 'VIDEO'.");
    F1(t, e, n, s)
}

function Os(t, e, n, s) {
    var r = e.data;
    const i = e.width,
        o = i * (e = e.height);
    if ((r instanceof Uint8Array || r instanceof Float32Array) && r.length !== o) throw Error("Unsupported channel count: " + r.length / o);
    return t = new it([r], n, !1, t.g.i.canvas, t.P, i, e), s ? t.clone() : t
}
var It = class extends wo {
    constructor(t, e, n, s) {
        super(t), this.g = t, this.Z = e, this.U = n, this.na = s, this.P = new Ta
    }
    l(t, e = !0) {
        if ("runningMode" in t && cr(this.baseOptions, 2, !!t.runningMode && t.runningMode !== "IMAGE"), t.canvas !== void 0 && this.g.i.canvas !== t.canvas) throw Error("You must create a new task to reset the canvas.");
        return super.l(t, e)
    }
    close() {
        this.P.close(), super.close()
    }
};
It.prototype.close = It.prototype.close;
var Yt = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect_in", !1), this.j = {
            detections: []
        }, pe(t = this.h = new Si, 0, 1, e = new ze), ae(this.h, 2, .5), ae(this.h, 3, .3)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return "minDetectionConfidence" in t && ae(this.h, 2, t.minDetectionConfidence ?? .5), "minSuppressionThreshold" in t && ae(this.h, 3, t.minSuppressionThreshold ?? .3), this.l(t)
    }
    D(t, e) {
        return this.j = {
            detections: []
        }, tn(this, t, e), this.j
    }
    F(t, e, n) {
        return this.j = {
            detections: []
        }, vn(this, t, n, e), this.j
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect_in"), Se(t, "detections");
        const e = new jt;
        an(e, U2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.face_detector.FaceDetectorGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect_in"), xe(n, "DETECTIONS:detections"), n.o(e), Wt(t, n), this.g.attachProtoVectorListener("detections", (s, r) => {
            for (const i of s) s = s1(i), this.j.detections.push(P1(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("detections", s => {
            re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
Yt.prototype.detectForVideo = Yt.prototype.F, Yt.prototype.detect = Yt.prototype.D, Yt.prototype.setOptions = Yt.prototype.o, Yt.createFromModelPath = async function (t, e) {
    return be(Yt, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Yt.createFromModelBuffer = function (t, e) {
    return be(Yt, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Yt.createFromOptions = function (t, e) {
    return be(Yt, t, e)
};
var Ma = ln([61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314], [314, 405], [405, 321], [321, 375], [375, 291], [61, 185], [185, 40], [40, 39], [39, 37], [37, 0], [0, 267], [267, 269], [269, 270], [270, 409], [409, 291], [78, 95], [95, 88], [88, 178], [178, 87], [87, 14], [14, 317], [317, 402], [402, 318], [318, 324], [324, 308], [78, 191], [191, 80], [80, 81], [81, 82], [82, 13], [13, 312], [312, 311], [311, 310], [310, 415], [415, 308]),
    Ra = ln([263, 249], [249, 390], [390, 373], [373, 374], [374, 380], [380, 381], [381, 382], [382, 362], [263, 466], [466, 388], [388, 387], [387, 386], [386, 385], [385, 384], [384, 398], [398, 362]),
    Pa = ln([276, 283], [283, 282], [282, 295], [295, 285], [300, 293], [293, 334], [334, 296], [296, 336]),
    C1 = ln([474, 475], [475, 476], [476, 477], [477, 474]),
    Ba = ln([33, 7], [7, 163], [163, 144], [144, 145], [145, 153], [153, 154], [154, 155], [155, 133], [33, 246], [246, 161], [161, 160], [160, 159], [159, 158], [158, 157], [157, 173], [173, 133]),
    Ia = ln([46, 53], [53, 52], [52, 65], [65, 55], [70, 63], [63, 105], [105, 66], [66, 107]),
    D1 = ln([469, 470], [470, 471], [471, 472], [472, 469]),
    Oa = ln([10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389], [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397], [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152], [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172], [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162], [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10]),
    G1 = [...Ma, ...Ra, ...Pa, ...Ba, ...Ia, ...Oa],
    V1 = ln([127, 34], [34, 139], [139, 127], [11, 0], [0, 37], [37, 11], [232, 231], [231, 120], [120, 232], [72, 37], [37, 39], [39, 72], [128, 121], [121, 47], [47, 128], [232, 121], [121, 128], [128, 232], [104, 69], [69, 67], [67, 104], [175, 171], [171, 148], [148, 175], [118, 50], [50, 101], [101, 118], [73, 39], [39, 40], [40, 73], [9, 151], [151, 108], [108, 9], [48, 115], [115, 131], [131, 48], [194, 204], [204, 211], [211, 194], [74, 40], [40, 185], [185, 74], [80, 42], [42, 183], [183, 80], [40, 92], [92, 186], [186, 40], [230, 229], [229, 118], [118, 230], [202, 212], [212, 214], [214, 202], [83, 18], [18, 17], [17, 83], [76, 61], [61, 146], [146, 76], [160, 29], [29, 30], [30, 160], [56, 157], [157, 173], [173, 56], [106, 204], [204, 194], [194, 106], [135, 214], [214, 192], [192, 135], [203, 165], [165, 98], [98, 203], [21, 71], [71, 68], [68, 21], [51, 45], [45, 4], [4, 51], [144, 24], [24, 23], [23, 144], [77, 146], [146, 91], [91, 77], [205, 50], [50, 187], [187, 205], [201, 200], [200, 18], [18, 201], [91, 106], [106, 182], [182, 91], [90, 91], [91, 181], [181, 90], [85, 84], [84, 17], [17, 85], [206, 203], [203, 36], [36, 206], [148, 171], [171, 140], [140, 148], [92, 40], [40, 39], [39, 92], [193, 189], [189, 244], [244, 193], [159, 158], [158, 28], [28, 159], [247, 246], [246, 161], [161, 247], [236, 3], [3, 196], [196, 236], [54, 68], [68, 104], [104, 54], [193, 168], [168, 8], [8, 193], [117, 228], [228, 31], [31, 117], [189, 193], [193, 55], [55, 189], [98, 97], [97, 99], [99, 98], [126, 47], [47, 100], [100, 126], [166, 79], [79, 218], [218, 166], [155, 154], [154, 26], [26, 155], [209, 49], [49, 131], [131, 209], [135, 136], [136, 150], [150, 135], [47, 126], [126, 217], [217, 47], [223, 52], [52, 53], [53, 223], [45, 51], [51, 134], [134, 45], [211, 170], [170, 140], [140, 211], [67, 69], [69, 108], [108, 67], [43, 106], [106, 91], [91, 43], [230, 119], [119, 120], [120, 230], [226, 130], [130, 247], [247, 226], [63, 53], [53, 52], [52, 63], [238, 20], [20, 242], [242, 238], [46, 70], [70, 156], [156, 46], [78, 62], [62, 96], [96, 78], [46, 53], [53, 63], [63, 46], [143, 34], [34, 227], [227, 143], [123, 117], [117, 111], [111, 123], [44, 125], [125, 19], [19, 44], [236, 134], [134, 51], [51, 236], [216, 206], [206, 205], [205, 216], [154, 153], [153, 22], [22, 154], [39, 37], [37, 167], [167, 39], [200, 201], [201, 208], [208, 200], [36, 142], [142, 100], [100, 36], [57, 212], [212, 202], [202, 57], [20, 60], [60, 99], [99, 20], [28, 158], [158, 157], [157, 28], [35, 226], [226, 113], [113, 35], [160, 159], [159, 27], [27, 160], [204, 202], [202, 210], [210, 204], [113, 225], [225, 46], [46, 113], [43, 202], [202, 204], [204, 43], [62, 76], [76, 77], [77, 62], [137, 123], [123, 116], [116, 137], [41, 38], [38, 72], [72, 41], [203, 129], [129, 142], [142, 203], [64, 98], [98, 240], [240, 64], [49, 102], [102, 64], [64, 49], [41, 73], [73, 74], [74, 41], [212, 216], [216, 207], [207, 212], [42, 74], [74, 184], [184, 42], [169, 170], [170, 211], [211, 169], [170, 149], [149, 176], [176, 170], [105, 66], [66, 69], [69, 105], [122, 6], [6, 168], [168, 122], [123, 147], [147, 187], [187, 123], [96, 77], [77, 90], [90, 96], [65, 55], [55, 107], [107, 65], [89, 90], [90, 180], [180, 89], [101, 100], [100, 120], [120, 101], [63, 105], [105, 104], [104, 63], [93, 137], [137, 227], [227, 93], [15, 86], [86, 85], [85, 15], [129, 102], [102, 49], [49, 129], [14, 87], [87, 86], [86, 14], [55, 8], [8, 9], [9, 55], [100, 47], [47, 121], [121, 100], [145, 23], [23, 22], [22, 145], [88, 89], [89, 179], [179, 88], [6, 122], [122, 196], [196, 6], [88, 95], [95, 96], [96, 88], [138, 172], [172, 136], [136, 138], [215, 58], [58, 172], [172, 215], [115, 48], [48, 219], [219, 115], [42, 80], [80, 81], [81, 42], [195, 3], [3, 51], [51, 195], [43, 146], [146, 61], [61, 43], [171, 175], [175, 199], [199, 171], [81, 82], [82, 38], [38, 81], [53, 46], [46, 225], [225, 53], [144, 163], [163, 110], [110, 144], [52, 65], [65, 66], [66, 52], [229, 228], [228, 117], [117, 229], [34, 127], [127, 234], [234, 34], [107, 108], [108, 69], [69, 107], [109, 108], [108, 151], [151, 109], [48, 64], [64, 235], [235, 48], [62, 78], [78, 191], [191, 62], [129, 209], [209, 126], [126, 129], [111, 35], [35, 143], [143, 111], [117, 123], [123, 50], [50, 117], [222, 65], [65, 52], [52, 222], [19, 125], [125, 141], [141, 19], [221, 55], [55, 65], [65, 221], [3, 195], [195, 197], [197, 3], [25, 7], [7, 33], [33, 25], [220, 237], [237, 44], [44, 220], [70, 71], [71, 139], [139, 70], [122, 193], [193, 245], [245, 122], [247, 130], [130, 33], [33, 247], [71, 21], [21, 162], [162, 71], [170, 169], [169, 150], [150, 170], [188, 174], [174, 196], [196, 188], [216, 186], [186, 92], [92, 216], [2, 97], [97, 167], [167, 2], [141, 125], [125, 241], [241, 141], [164, 167], [167, 37], [37, 164], [72, 38], [38, 12], [12, 72], [38, 82], [82, 13], [13, 38], [63, 68], [68, 71], [71, 63], [226, 35], [35, 111], [111, 226], [101, 50], [50, 205], [205, 101], [206, 92], [92, 165], [165, 206], [209, 198], [198, 217], [217, 209], [165, 167], [167, 97], [97, 165], [220, 115], [115, 218], [218, 220], [133, 112], [112, 243], [243, 133], [239, 238], [238, 241], [241, 239], [214, 135], [135, 169], [169, 214], [190, 173], [173, 133], [133, 190], [171, 208], [208, 32], [32, 171], [125, 44], [44, 237], [237, 125], [86, 87], [87, 178], [178, 86], [85, 86], [86, 179], [179, 85], [84, 85], [85, 180], [180, 84], [83, 84], [84, 181], [181, 83], [201, 83], [83, 182], [182, 201], [137, 93], [93, 132], [132, 137], [76, 62], [62, 183], [183, 76], [61, 76], [76, 184], [184, 61], [57, 61], [61, 185], [185, 57], [212, 57], [57, 186], [186, 212], [214, 207], [207, 187], [187, 214], [34, 143], [143, 156], [156, 34], [79, 239], [239, 237], [237, 79], [123, 137], [137, 177], [177, 123], [44, 1], [1, 4], [4, 44], [201, 194], [194, 32], [32, 201], [64, 102], [102, 129], [129, 64], [213, 215], [215, 138], [138, 213], [59, 166], [166, 219], [219, 59], [242, 99], [99, 97], [97, 242], [2, 94], [94, 141], [141, 2], [75, 59], [59, 235], [235, 75], [24, 110], [110, 228], [228, 24], [25, 130], [130, 226], [226, 25], [23, 24], [24, 229], [229, 23], [22, 23], [23, 230], [230, 22], [26, 22], [22, 231], [231, 26], [112, 26], [26, 232], [232, 112], [189, 190], [190, 243], [243, 189], [221, 56], [56, 190], [190, 221], [28, 56], [56, 221], [221, 28], [27, 28], [28, 222], [222, 27], [29, 27], [27, 223], [223, 29], [30, 29], [29, 224], [224, 30], [247, 30], [30, 225], [225, 247], [238, 79], [79, 20], [20, 238], [166, 59], [59, 75], [75, 166], [60, 75], [75, 240], [240, 60], [147, 177], [177, 215], [215, 147], [20, 79], [79, 166], [166, 20], [187, 147], [147, 213], [213, 187], [112, 233], [233, 244], [244, 112], [233, 128], [128, 245], [245, 233], [128, 114], [114, 188], [188, 128], [114, 217], [217, 174], [174, 114], [131, 115], [115, 220], [220, 131], [217, 198], [198, 236], [236, 217], [198, 131], [131, 134], [134, 198], [177, 132], [132, 58], [58, 177], [143, 35], [35, 124], [124, 143], [110, 163], [163, 7], [7, 110], [228, 110], [110, 25], [25, 228], [356, 389], [389, 368], [368, 356], [11, 302], [302, 267], [267, 11], [452, 350], [350, 349], [349, 452], [302, 303], [303, 269], [269, 302], [357, 343], [343, 277], [277, 357], [452, 453], [453, 357], [357, 452], [333, 332], [332, 297], [297, 333], [175, 152], [152, 377], [377, 175], [347, 348], [348, 330], [330, 347], [303, 304], [304, 270], [270, 303], [9, 336], [336, 337], [337, 9], [278, 279], [279, 360], [360, 278], [418, 262], [262, 431], [431, 418], [304, 408], [408, 409], [409, 304], [310, 415], [415, 407], [407, 310], [270, 409], [409, 410], [410, 270], [450, 348], [348, 347], [347, 450], [422, 430], [430, 434], [434, 422], [313, 314], [314, 17], [17, 313], [306, 307], [307, 375], [375, 306], [387, 388], [388, 260], [260, 387], [286, 414], [414, 398], [398, 286], [335, 406], [406, 418], [418, 335], [364, 367], [367, 416], [416, 364], [423, 358], [358, 327], [327, 423], [251, 284], [284, 298], [298, 251], [281, 5], [5, 4], [4, 281], [373, 374], [374, 253], [253, 373], [307, 320], [320, 321], [321, 307], [425, 427], [427, 411], [411, 425], [421, 313], [313, 18], [18, 421], [321, 405], [405, 406], [406, 321], [320, 404], [404, 405], [405, 320], [315, 16], [16, 17], [17, 315], [426, 425], [425, 266], [266, 426], [377, 400], [400, 369], [369, 377], [322, 391], [391, 269], [269, 322], [417, 465], [465, 464], [464, 417], [386, 257], [257, 258], [258, 386], [466, 260], [260, 388], [388, 466], [456, 399], [399, 419], [419, 456], [284, 332], [332, 333], [333, 284], [417, 285], [285, 8], [8, 417], [346, 340], [340, 261], [261, 346], [413, 441], [441, 285], [285, 413], [327, 460], [460, 328], [328, 327], [355, 371], [371, 329], [329, 355], [392, 439], [439, 438], [438, 392], [382, 341], [341, 256], [256, 382], [429, 420], [420, 360], [360, 429], [364, 394], [394, 379], [379, 364], [277, 343], [343, 437], [437, 277], [443, 444], [444, 283], [283, 443], [275, 440], [440, 363], [363, 275], [431, 262], [262, 369], [369, 431], [297, 338], [338, 337], [337, 297], [273, 375], [375, 321], [321, 273], [450, 451], [451, 349], [349, 450], [446, 342], [342, 467], [467, 446], [293, 334], [334, 282], [282, 293], [458, 461], [461, 462], [462, 458], [276, 353], [353, 383], [383, 276], [308, 324], [324, 325], [325, 308], [276, 300], [300, 293], [293, 276], [372, 345], [345, 447], [447, 372], [352, 345], [345, 340], [340, 352], [274, 1], [1, 19], [19, 274], [456, 248], [248, 281], [281, 456], [436, 427], [427, 425], [425, 436], [381, 256], [256, 252], [252, 381], [269, 391], [391, 393], [393, 269], [200, 199], [199, 428], [428, 200], [266, 330], [330, 329], [329, 266], [287, 273], [273, 422], [422, 287], [250, 462], [462, 328], [328, 250], [258, 286], [286, 384], [384, 258], [265, 353], [353, 342], [342, 265], [387, 259], [259, 257], [257, 387], [424, 431], [431, 430], [430, 424], [342, 353], [353, 276], [276, 342], [273, 335], [335, 424], [424, 273], [292, 325], [325, 307], [307, 292], [366, 447], [447, 345], [345, 366], [271, 303], [303, 302], [302, 271], [423, 266], [266, 371], [371, 423], [294, 455], [455, 460], [460, 294], [279, 278], [278, 294], [294, 279], [271, 272], [272, 304], [304, 271], [432, 434], [434, 427], [427, 432], [272, 407], [407, 408], [408, 272], [394, 430], [430, 431], [431, 394], [395, 369], [369, 400], [400, 395], [334, 333], [333, 299], [299, 334], [351, 417], [417, 168], [168, 351], [352, 280], [280, 411], [411, 352], [325, 319], [319, 320], [320, 325], [295, 296], [296, 336], [336, 295], [319, 403], [403, 404], [404, 319], [330, 348], [348, 349], [349, 330], [293, 298], [298, 333], [333, 293], [323, 454], [454, 447], [447, 323], [15, 16], [16, 315], [315, 15], [358, 429], [429, 279], [279, 358], [14, 15], [15, 316], [316, 14], [285, 336], [336, 9], [9, 285], [329, 349], [349, 350], [350, 329], [374, 380], [380, 252], [252, 374], [318, 402], [402, 403], [403, 318], [6, 197], [197, 419], [419, 6], [318, 319], [319, 325], [325, 318], [367, 364], [364, 365], [365, 367], [435, 367], [367, 397], [397, 435], [344, 438], [438, 439], [439, 344], [272, 271], [271, 311], [311, 272], [195, 5], [5, 281], [281, 195], [273, 287], [287, 291], [291, 273], [396, 428], [428, 199], [199, 396], [311, 271], [271, 268], [268, 311], [283, 444], [444, 445], [445, 283], [373, 254], [254, 339], [339, 373], [282, 334], [334, 296], [296, 282], [449, 347], [347, 346], [346, 449], [264, 447], [447, 454], [454, 264], [336, 296], [296, 299], [299, 336], [338, 10], [10, 151], [151, 338], [278, 439], [439, 455], [455, 278], [292, 407], [407, 415], [415, 292], [358, 371], [371, 355], [355, 358], [340, 345], [345, 372], [372, 340], [346, 347], [347, 280], [280, 346], [442, 443], [443, 282], [282, 442], [19, 94], [94, 370], [370, 19], [441, 442], [442, 295], [295, 441], [248, 419], [419, 197], [197, 248], [263, 255], [255, 359], [359, 263], [440, 275], [275, 274], [274, 440], [300, 383], [383, 368], [368, 300], [351, 412], [412, 465], [465, 351], [263, 467], [467, 466], [466, 263], [301, 368], [368, 389], [389, 301], [395, 378], [378, 379], [379, 395], [412, 351], [351, 419], [419, 412], [436, 426], [426, 322], [322, 436], [2, 164], [164, 393], [393, 2], [370, 462], [462, 461], [461, 370], [164, 0], [0, 267], [267, 164], [302, 11], [11, 12], [12, 302], [268, 12], [12, 13], [13, 268], [293, 300], [300, 301], [301, 293], [446, 261], [261, 340], [340, 446], [330, 266], [266, 425], [425, 330], [426, 423], [423, 391], [391, 426], [429, 355], [355, 437], [437, 429], [391, 327], [327, 326], [326, 391], [440, 457], [457, 438], [438, 440], [341, 382], [382, 362], [362, 341], [459, 457], [457, 461], [461, 459], [434, 430], [430, 394], [394, 434], [414, 463], [463, 362], [362, 414], [396, 369], [369, 262], [262, 396], [354, 461], [461, 457], [457, 354], [316, 403], [403, 402], [402, 316], [315, 404], [404, 403], [403, 315], [314, 405], [405, 404], [404, 314], [313, 406], [406, 405], [405, 313], [421, 418], [418, 406], [406, 421], [366, 401], [401, 361], [361, 366], [306, 408], [408, 407], [407, 306], [291, 409], [409, 408], [408, 291], [287, 410], [410, 409], [409, 287], [432, 436], [436, 410], [410, 432], [434, 416], [416, 411], [411, 434], [264, 368], [368, 383], [383, 264], [309, 438], [438, 457], [457, 309], [352, 376], [376, 401], [401, 352], [274, 275], [275, 4], [4, 274], [421, 428], [428, 262], [262, 421], [294, 327], [327, 358], [358, 294], [433, 416], [416, 367], [367, 433], [289, 455], [455, 439], [439, 289], [462, 370], [370, 326], [326, 462], [2, 326], [326, 370], [370, 2], [305, 460], [460, 455], [455, 305], [254, 449], [449, 448], [448, 254], [255, 261], [261, 446], [446, 255], [253, 450], [450, 449], [449, 253], [252, 451], [451, 450], [450, 252], [256, 452], [452, 451], [451, 256], [341, 453], [453, 452], [452, 341], [413, 464], [464, 463], [463, 413], [441, 413], [413, 414], [414, 441], [258, 442], [442, 441], [441, 258], [257, 443], [443, 442], [442, 257], [259, 444], [444, 443], [443, 259], [260, 445], [445, 444], [444, 260], [467, 342], [342, 445], [445, 467], [459, 458], [458, 250], [250, 459], [289, 392], [392, 290], [290, 289], [290, 328], [328, 460], [460, 290], [376, 433], [433, 435], [435, 376], [250, 290], [290, 392], [392, 250], [411, 416], [416, 433], [433, 411], [341, 463], [463, 464], [464, 341], [453, 464], [464, 465], [465, 453], [357, 465], [465, 412], [412, 357], [343, 412], [412, 399], [399, 343], [360, 363], [363, 440], [440, 360], [437, 399], [399, 456], [456, 437], [420, 456], [456, 363], [363, 420], [401, 435], [435, 288], [288, 401], [372, 383], [383, 353], [353, 372], [339, 255], [255, 249], [249, 339], [448, 261], [261, 255], [255, 448], [133, 243], [243, 190], [190, 133], [133, 155], [155, 112], [112, 133], [33, 246], [246, 247], [247, 33], [33, 130], [130, 25], [25, 33], [398, 384], [384, 286], [286, 398], [362, 398], [398, 414], [414, 362], [362, 463], [463, 341], [341, 362], [263, 359], [359, 467], [467, 263], [263, 249], [249, 255], [255, 263], [466, 467], [467, 260], [260, 466], [75, 60], [60, 166], [166, 75], [238, 239], [239, 79], [79, 238], [162, 127], [127, 139], [139, 162], [72, 11], [11, 37], [37, 72], [121, 232], [232, 120], [120, 121], [73, 72], [72, 39], [39, 73], [114, 128], [128, 47], [47, 114], [233, 232], [232, 128], [128, 233], [103, 104], [104, 67], [67, 103], [152, 175], [175, 148], [148, 152], [119, 118], [118, 101], [101, 119], [74, 73], [73, 40], [40, 74], [107, 9], [9, 108], [108, 107], [49, 48], [48, 131], [131, 49], [32, 194], [194, 211], [211, 32], [184, 74], [74, 185], [185, 184], [191, 80], [80, 183], [183, 191], [185, 40], [40, 186], [186, 185], [119, 230], [230, 118], [118, 119], [210, 202], [202, 214], [214, 210], [84, 83], [83, 17], [17, 84], [77, 76], [76, 146], [146, 77], [161, 160], [160, 30], [30, 161], [190, 56], [56, 173], [173, 190], [182, 106], [106, 194], [194, 182], [138, 135], [135, 192], [192, 138], [129, 203], [203, 98], [98, 129], [54, 21], [21, 68], [68, 54], [5, 51], [51, 4], [4, 5], [145, 144], [144, 23], [23, 145], [90, 77], [77, 91], [91, 90], [207, 205], [205, 187], [187, 207], [83, 201], [201, 18], [18, 83], [181, 91], [91, 182], [182, 181], [180, 90], [90, 181], [181, 180], [16, 85], [85, 17], [17, 16], [205, 206], [206, 36], [36, 205], [176, 148], [148, 140], [140, 176], [165, 92], [92, 39], [39, 165], [245, 193], [193, 244], [244, 245], [27, 159], [159, 28], [28, 27], [30, 247], [247, 161], [161, 30], [174, 236], [236, 196], [196, 174], [103, 54], [54, 104], [104, 103], [55, 193], [193, 8], [8, 55], [111, 117], [117, 31], [31, 111], [221, 189], [189, 55], [55, 221], [240, 98], [98, 99], [99, 240], [142, 126], [126, 100], [100, 142], [219, 166], [166, 218], [218, 219], [112, 155], [155, 26], [26, 112], [198, 209], [209, 131], [131, 198], [169, 135], [135, 150], [150, 169], [114, 47], [47, 217], [217, 114], [224, 223], [223, 53], [53, 224], [220, 45], [45, 134], [134, 220], [32, 211], [211, 140], [140, 32], [109, 67], [67, 108], [108, 109], [146, 43], [43, 91], [91, 146], [231, 230], [230, 120], [120, 231], [113, 226], [226, 247], [247, 113], [105, 63], [63, 52], [52, 105], [241, 238], [238, 242], [242, 241], [124, 46], [46, 156], [156, 124], [95, 78], [78, 96], [96, 95], [70, 46], [46, 63], [63, 70], [116, 143], [143, 227], [227, 116], [116, 123], [123, 111], [111, 116], [1, 44], [44, 19], [19, 1], [3, 236], [236, 51], [51, 3], [207, 216], [216, 205], [205, 207], [26, 154], [154, 22], [22, 26], [165, 39], [39, 167], [167, 165], [199, 200], [200, 208], [208, 199], [101, 36], [36, 100], [100, 101], [43, 57], [57, 202], [202, 43], [242, 20], [20, 99], [99, 242], [56, 28], [28, 157], [157, 56], [124, 35], [35, 113], [113, 124], [29, 160], [160, 27], [27, 29], [211, 204], [204, 210], [210, 211], [124, 113], [113, 46], [46, 124], [106, 43], [43, 204], [204, 106], [96, 62], [62, 77], [77, 96], [227, 137], [137, 116], [116, 227], [73, 41], [41, 72], [72, 73], [36, 203], [203, 142], [142, 36], [235, 64], [64, 240], [240, 235], [48, 49], [49, 64], [64, 48], [42, 41], [41, 74], [74, 42], [214, 212], [212, 207], [207, 214], [183, 42], [42, 184], [184, 183], [210, 169], [169, 211], [211, 210], [140, 170], [170, 176], [176, 140], [104, 105], [105, 69], [69, 104], [193, 122], [122, 168], [168, 193], [50, 123], [123, 187], [187, 50], [89, 96], [96, 90], [90, 89], [66, 65], [65, 107], [107, 66], [179, 89], [89, 180], [180, 179], [119, 101], [101, 120], [120, 119], [68, 63], [63, 104], [104, 68], [234, 93], [93, 227], [227, 234], [16, 15], [15, 85], [85, 16], [209, 129], [129, 49], [49, 209], [15, 14], [14, 86], [86, 15], [107, 55], [55, 9], [9, 107], [120, 100], [100, 121], [121, 120], [153, 145], [145, 22], [22, 153], [178, 88], [88, 179], [179, 178], [197, 6], [6, 196], [196, 197], [89, 88], [88, 96], [96, 89], [135, 138], [138, 136], [136, 135], [138, 215], [215, 172], [172, 138], [218, 115], [115, 219], [219, 218], [41, 42], [42, 81], [81, 41], [5, 195], [195, 51], [51, 5], [57, 43], [43, 61], [61, 57], [208, 171], [171, 199], [199, 208], [41, 81], [81, 38], [38, 41], [224, 53], [53, 225], [225, 224], [24, 144], [144, 110], [110, 24], [105, 52], [52, 66], [66, 105], [118, 229], [229, 117], [117, 118], [227, 34], [34, 234], [234, 227], [66, 107], [107, 69], [69, 66], [10, 109], [109, 151], [151, 10], [219, 48], [48, 235], [235, 219], [183, 62], [62, 191], [191, 183], [142, 129], [129, 126], [126, 142], [116, 111], [111, 143], [143, 116], [118, 117], [117, 50], [50, 118], [223, 222], [222, 52], [52, 223], [94, 19], [19, 141], [141, 94], [222, 221], [221, 65], [65, 222], [196, 3], [3, 197], [197, 196], [45, 220], [220, 44], [44, 45], [156, 70], [70, 139], [139, 156], [188, 122], [122, 245], [245, 188], [139, 71], [71, 162], [162, 139], [149, 170], [170, 150], [150, 149], [122, 188], [188, 196], [196, 122], [206, 216], [216, 92], [92, 206], [164, 2], [2, 167], [167, 164], [242, 141], [141, 241], [241, 242], [0, 164], [164, 37], [37, 0], [11, 72], [72, 12], [12, 11], [12, 38], [38, 13], [13, 12], [70, 63], [63, 71], [71, 70], [31, 226], [226, 111], [111, 31], [36, 101], [101, 205], [205, 36], [203, 206], [206, 165], [165, 203], [126, 209], [209, 217], [217, 126], [98, 165], [165, 97], [97, 98], [237, 220], [220, 218], [218, 237], [237, 239], [239, 241], [241, 237], [210, 214], [214, 169], [169, 210], [140, 171], [171, 32], [32, 140], [241, 125], [125, 237], [237, 241], [179, 86], [86, 178], [178, 179], [180, 85], [85, 179], [179, 180], [181, 84], [84, 180], [180, 181], [182, 83], [83, 181], [181, 182], [194, 201], [201, 182], [182, 194], [177, 137], [137, 132], [132, 177], [184, 76], [76, 183], [183, 184], [185, 61], [61, 184], [184, 185], [186, 57], [57, 185], [185, 186], [216, 212], [212, 186], [186, 216], [192, 214], [214, 187], [187, 192], [139, 34], [34, 156], [156, 139], [218, 79], [79, 237], [237, 218], [147, 123], [123, 177], [177, 147], [45, 44], [44, 4], [4, 45], [208, 201], [201, 32], [32, 208], [98, 64], [64, 129], [129, 98], [192, 213], [213, 138], [138, 192], [235, 59], [59, 219], [219, 235], [141, 242], [242, 97], [97, 141], [97, 2], [2, 141], [141, 97], [240, 75], [75, 235], [235, 240], [229, 24], [24, 228], [228, 229], [31, 25], [25, 226], [226, 31], [230, 23], [23, 229], [229, 230], [231, 22], [22, 230], [230, 231], [232, 26], [26, 231], [231, 232], [233, 112], [112, 232], [232, 233], [244, 189], [189, 243], [243, 244], [189, 221], [221, 190], [190, 189], [222, 28], [28, 221], [221, 222], [223, 27], [27, 222], [222, 223], [224, 29], [29, 223], [223, 224], [225, 30], [30, 224], [224, 225], [113, 247], [247, 225], [225, 113], [99, 60], [60, 240], [240, 99], [213, 147], [147, 215], [215, 213], [60, 20], [20, 166], [166, 60], [192, 187], [187, 213], [213, 192], [243, 112], [112, 244], [244, 243], [244, 233], [233, 245], [245, 244], [245, 128], [128, 188], [188, 245], [188, 114], [114, 174], [174, 188], [134, 131], [131, 220], [220, 134], [174, 217], [217, 236], [236, 174], [236, 198], [198, 134], [134, 236], [215, 177], [177, 58], [58, 215], [156, 143], [143, 124], [124, 156], [25, 110], [110, 7], [7, 25], [31, 228], [228, 25], [25, 31], [264, 356], [356, 368], [368, 264], [0, 11], [11, 267], [267, 0], [451, 452], [452, 349], [349, 451], [267, 302], [302, 269], [269, 267], [350, 357], [357, 277], [277, 350], [350, 452], [452, 357], [357, 350], [299, 333], [333, 297], [297, 299], [396, 175], [175, 377], [377, 396], [280, 347], [347, 330], [330, 280], [269, 303], [303, 270], [270, 269], [151, 9], [9, 337], [337, 151], [344, 278], [278, 360], [360, 344], [424, 418], [418, 431], [431, 424], [270, 304], [304, 409], [409, 270], [272, 310], [310, 407], [407, 272], [322, 270], [270, 410], [410, 322], [449, 450], [450, 347], [347, 449], [432, 422], [422, 434], [434, 432], [18, 313], [313, 17], [17, 18], [291, 306], [306, 375], [375, 291], [259, 387], [387, 260], [260, 259], [424, 335], [335, 418], [418, 424], [434, 364], [364, 416], [416, 434], [391, 423], [423, 327], [327, 391], [301, 251], [251, 298], [298, 301], [275, 281], [281, 4], [4, 275], [254, 373], [373, 253], [253, 254], [375, 307], [307, 321], [321, 375], [280, 425], [425, 411], [411, 280], [200, 421], [421, 18], [18, 200], [335, 321], [321, 406], [406, 335], [321, 320], [320, 405], [405, 321], [314, 315], [315, 17], [17, 314], [423, 426], [426, 266], [266, 423], [396, 377], [377, 369], [369, 396], [270, 322], [322, 269], [269, 270], [413, 417], [417, 464], [464, 413], [385, 386], [386, 258], [258, 385], [248, 456], [456, 419], [419, 248], [298, 284], [284, 333], [333, 298], [168, 417], [417, 8], [8, 168], [448, 346], [346, 261], [261, 448], [417, 413], [413, 285], [285, 417], [326, 327], [327, 328], [328, 326], [277, 355], [355, 329], [329, 277], [309, 392], [392, 438], [438, 309], [381, 382], [382, 256], [256, 381], [279, 429], [429, 360], [360, 279], [365, 364], [364, 379], [379, 365], [355, 277], [277, 437], [437, 355], [282, 443], [443, 283], [283, 282], [281, 275], [275, 363], [363, 281], [395, 431], [431, 369], [369, 395], [299, 297], [297, 337], [337, 299], [335, 273], [273, 321], [321, 335], [348, 450], [450, 349], [349, 348], [359, 446], [446, 467], [467, 359], [283, 293], [293, 282], [282, 283], [250, 458], [458, 462], [462, 250], [300, 276], [276, 383], [383, 300], [292, 308], [308, 325], [325, 292], [283, 276], [276, 293], [293, 283], [264, 372], [372, 447], [447, 264], [346, 352], [352, 340], [340, 346], [354, 274], [274, 19], [19, 354], [363, 456], [456, 281], [281, 363], [426, 436], [436, 425], [425, 426], [380, 381], [381, 252], [252, 380], [267, 269], [269, 393], [393, 267], [421, 200], [200, 428], [428, 421], [371, 266], [266, 329], [329, 371], [432, 287], [287, 422], [422, 432], [290, 250], [250, 328], [328, 290], [385, 258], [258, 384], [384, 385], [446, 265], [265, 342], [342, 446], [386, 387], [387, 257], [257, 386], [422, 424], [424, 430], [430, 422], [445, 342], [342, 276], [276, 445], [422, 273], [273, 424], [424, 422], [306, 292], [292, 307], [307, 306], [352, 366], [366, 345], [345, 352], [268, 271], [271, 302], [302, 268], [358, 423], [423, 371], [371, 358], [327, 294], [294, 460], [460, 327], [331, 279], [279, 294], [294, 331], [303, 271], [271, 304], [304, 303], [436, 432], [432, 427], [427, 436], [304, 272], [272, 408], [408, 304], [395, 394], [394, 431], [431, 395], [378, 395], [395, 400], [400, 378], [296, 334], [334, 299], [299, 296], [6, 351], [351, 168], [168, 6], [376, 352], [352, 411], [411, 376], [307, 325], [325, 320], [320, 307], [285, 295], [295, 336], [336, 285], [320, 319], [319, 404], [404, 320], [329, 330], [330, 349], [349, 329], [334, 293], [293, 333], [333, 334], [366, 323], [323, 447], [447, 366], [316, 15], [15, 315], [315, 316], [331, 358], [358, 279], [279, 331], [317, 14], [14, 316], [316, 317], [8, 285], [285, 9], [9, 8], [277, 329], [329, 350], [350, 277], [253, 374], [374, 252], [252, 253], [319, 318], [318, 403], [403, 319], [351, 6], [6, 419], [419, 351], [324, 318], [318, 325], [325, 324], [397, 367], [367, 365], [365, 397], [288, 435], [435, 397], [397, 288], [278, 344], [344, 439], [439, 278], [310, 272], [272, 311], [311, 310], [248, 195], [195, 281], [281, 248], [375, 273], [273, 291], [291, 375], [175, 396], [396, 199], [199, 175], [312, 311], [311, 268], [268, 312], [276, 283], [283, 445], [445, 276], [390, 373], [373, 339], [339, 390], [295, 282], [282, 296], [296, 295], [448, 449], [449, 346], [346, 448], [356, 264], [264, 454], [454, 356], [337, 336], [336, 299], [299, 337], [337, 338], [338, 151], [151, 337], [294, 278], [278, 455], [455, 294], [308, 292], [292, 415], [415, 308], [429, 358], [358, 355], [355, 429], [265, 340], [340, 372], [372, 265], [352, 346], [346, 280], [280, 352], [295, 442], [442, 282], [282, 295], [354, 19], [19, 370], [370, 354], [285, 441], [441, 295], [295, 285], [195, 248], [248, 197], [197, 195], [457, 440], [440, 274], [274, 457], [301, 300], [300, 368], [368, 301], [417, 351], [351, 465], [465, 417], [251, 301], [301, 389], [389, 251], [394, 395], [395, 379], [379, 394], [399, 412], [412, 419], [419, 399], [410, 436], [436, 322], [322, 410], [326, 2], [2, 393], [393, 326], [354, 370], [370, 461], [461, 354], [393, 164], [164, 267], [267, 393], [268, 302], [302, 12], [12, 268], [312, 268], [268, 13], [13, 312], [298, 293], [293, 301], [301, 298], [265, 446], [446, 340], [340, 265], [280, 330], [330, 425], [425, 280], [322, 426], [426, 391], [391, 322], [420, 429], [429, 437], [437, 420], [393, 391], [391, 326], [326, 393], [344, 440], [440, 438], [438, 344], [458, 459], [459, 461], [461, 458], [364, 434], [434, 394], [394, 364], [428, 396], [396, 262], [262, 428], [274, 354], [354, 457], [457, 274], [317, 316], [316, 402], [402, 317], [316, 315], [315, 403], [403, 316], [315, 314], [314, 404], [404, 315], [314, 313], [313, 405], [405, 314], [313, 421], [421, 406], [406, 313], [323, 366], [366, 361], [361, 323], [292, 306], [306, 407], [407, 292], [306, 291], [291, 408], [408, 306], [291, 287], [287, 409], [409, 291], [287, 432], [432, 410], [410, 287], [427, 434], [434, 411], [411, 427], [372, 264], [264, 383], [383, 372], [459, 309], [309, 457], [457, 459], [366, 352], [352, 401], [401, 366], [1, 274], [274, 4], [4, 1], [418, 421], [421, 262], [262, 418], [331, 294], [294, 358], [358, 331], [435, 433], [433, 367], [367, 435], [392, 289], [289, 439], [439, 392], [328, 462], [462, 326], [326, 328], [94, 2], [2, 370], [370, 94], [289, 305], [305, 455], [455, 289], [339, 254], [254, 448], [448, 339], [359, 255], [255, 446], [446, 359], [254, 253], [253, 449], [449, 254], [253, 252], [252, 450], [450, 253], [252, 256], [256, 451], [451, 252], [256, 341], [341, 452], [452, 256], [414, 413], [413, 463], [463, 414], [286, 441], [441, 414], [414, 286], [286, 258], [258, 441], [441, 286], [258, 257], [257, 442], [442, 258], [257, 259], [259, 443], [443, 257], [259, 260], [260, 444], [444, 259], [260, 467], [467, 445], [445, 260], [309, 459], [459, 250], [250, 309], [305, 289], [289, 290], [290, 305], [305, 290], [290, 460], [460, 305], [401, 376], [376, 435], [435, 401], [309, 250], [250, 392], [392, 309], [376, 411], [411, 433], [433, 376], [453, 341], [341, 464], [464, 453], [357, 453], [453, 465], [465, 357], [343, 357], [357, 412], [412, 343], [437, 343], [343, 399], [399, 437], [344, 360], [360, 440], [440, 344], [420, 437], [437, 456], [456, 420], [360, 420], [420, 363], [363, 360], [361, 401], [401, 288], [288, 361], [265, 372], [372, 353], [353, 265], [390, 339], [339, 249], [249, 390], [339, 448], [448, 255], [255, 339]);

function hu(t) {
    t.j = {
        faceLandmarks: [],
        faceBlendshapes: [],
        facialTransformationMatrixes: []
    }
}
var je = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !1), this.j = {
            faceLandmarks: [],
            faceBlendshapes: [],
            facialTransformationMatrixes: []
        }, this.outputFacialTransformationMatrixes = this.outputFaceBlendshapes = !1, pe(t = this.h = new f1, 0, 1, e = new ze), this.v = new l1, pe(this.h, 0, 3, this.v), this.s = new Si, pe(this.h, 0, 2, this.s), wn(this.s, 4, 1), ae(this.s, 2, .5), ae(this.v, 2, .5), ae(this.h, 4, .5)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return "numFaces" in t && wn(this.s, 4, t.numFaces ?? 1), "minFaceDetectionConfidence" in t && ae(this.s, 2, t.minFaceDetectionConfidence ?? .5), "minTrackingConfidence" in t && ae(this.h, 4, t.minTrackingConfidence ?? .5), "minFacePresenceConfidence" in t && ae(this.v, 2, t.minFacePresenceConfidence ?? .5), "outputFaceBlendshapes" in t && (this.outputFaceBlendshapes = !!t.outputFaceBlendshapes), "outputFacialTransformationMatrixes" in t && (this.outputFacialTransformationMatrixes = !!t.outputFacialTransformationMatrixes), this.l(t)
    }
    D(t, e) {
        return hu(this), tn(this, t, e), this.j
    }
    F(t, e, n) {
        return hu(this), vn(this, t, n, e), this.j
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect"), Se(t, "face_landmarks");
        const e = new jt;
        an(e, C2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.face_landmarker.FaceLandmarkerGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "NORM_LANDMARKS:face_landmarks"), n.o(e), Wt(t, n), this.g.attachProtoVectorListener("face_landmarks", (s, r) => {
            for (const i of s) s = dr(i), this.j.faceLandmarks.push(Mi(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("face_landmarks", s => {
            re(this, s)
        }), this.outputFaceBlendshapes && (Se(t, "blendshapes"), xe(n, "BLENDSHAPES:blendshapes"), this.g.attachProtoVectorListener("blendshapes", (s, r) => {
            if (this.outputFaceBlendshapes)
                for (const i of s) s = Ti(i), this.j.faceBlendshapes.push(ba(s.g() ?? []));
            re(this, r)
        }), this.g.attachEmptyPacketListener("blendshapes", s => {
            re(this, s)
        })), this.outputFacialTransformationMatrixes && (Se(t, "face_geometry"), xe(n, "FACE_GEOMETRY:face_geometry"), this.g.attachProtoVectorListener("face_geometry", (s, r) => {
            if (this.outputFacialTransformationMatrixes)
                for (const i of s) (s = Ee(F2(i), R2, 2)) && this.j.facialTransformationMatrixes.push({
                    rows: Zt(s, 1) ?? 0 ?? 0,
                    columns: Zt(s, 2) ?? 0 ?? 0,
                    data: es(s, 3, Yn, Qn()).slice() ?? []
                });
            re(this, r)
        }), this.g.attachEmptyPacketListener("face_geometry", s => {
            re(this, s)
        })), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
je.prototype.detectForVideo = je.prototype.F, je.prototype.detect = je.prototype.D, je.prototype.setOptions = je.prototype.o, je.createFromModelPath = function (t, e) {
    return be(je, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, je.createFromModelBuffer = function (t, e) {
    return be(je, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, je.createFromOptions = function (t, e) {
    return be(je, t, e)
}, je.FACE_LANDMARKS_LIPS = Ma, je.FACE_LANDMARKS_LEFT_EYE = Ra, je.FACE_LANDMARKS_LEFT_EYEBROW = Pa, je.FACE_LANDMARKS_LEFT_IRIS = C1, je.FACE_LANDMARKS_RIGHT_EYE = Ba, je.FACE_LANDMARKS_RIGHT_EYEBROW = Ia, je.FACE_LANDMARKS_RIGHT_IRIS = D1, je.FACE_LANDMARKS_FACE_OVAL = Oa, je.FACE_LANDMARKS_CONTOURS = G1, je.FACE_LANDMARKS_TESSELATION = V1;
var dn = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !0), pe(t = this.j = new d1, 0, 1, e = new ze)
    }
    get baseOptions() {
        return Ee(this.j, ze, 1)
    }
    set baseOptions(t) {
        pe(this.j, 0, 1, t)
    }
    o(t) {
        return super.l(t)
    }
    Ka(t, e, n) {
        const s = typeof e != "function" ? e : {};
        if (this.h = typeof e == "function" ? e : n, tn(this, t, s ?? {}), !this.h) return this.s
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect"), Se(t, "stylized_image");
        const e = new jt;
        an(e, D2, this.j);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.face_stylizer.FaceStylizerGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "STYLIZED_IMAGE:stylized_image"), n.o(e), Wt(t, n), this.g.V("stylized_image", (s, r) => {
            var i = !this.h,
                o = s.data,
                c = s.width;
            const f = c * (s = s.height);
            if (o instanceof Uint8Array)
                if (o.length === 3 * f) {
                    const _ = new Uint8ClampedArray(4 * f);
                    for (let M = 0; M < f; ++M) _[4 * M] = o[3 * M], _[4 * M + 1] = o[3 * M + 1], _[4 * M + 2] = o[3 * M + 2], _[4 * M + 3] = 255;
                    o = new ImageData(_, c, s)
                } else {
                    if (o.length !== 4 * f) throw Error("Unsupported channel count: " + o.length / f);
                    o = new ImageData(new Uint8ClampedArray(o.buffer, o.byteOffset, o.length), c, s)
                }
            else if (!(o instanceof WebGLTexture)) throw Error(`Unsupported format: ${o.constructor.name}`);
            c = new ot([o], !1, !1, this.g.i.canvas, this.P, c, s), this.s = i = i ? c.clone() : c, this.h && this.h(i), re(this, r)
        }), this.g.attachEmptyPacketListener("stylized_image", s => {
            this.s = null, this.h && this.h(null), re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
dn.prototype.stylize = dn.prototype.Ka, dn.prototype.setOptions = dn.prototype.o, dn.createFromModelPath = function (t, e) {
    return be(dn, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, dn.createFromModelBuffer = function (t, e) {
    return be(dn, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, dn.createFromOptions = function (t, e) {
    return be(dn, t, e)
};
var La = ln([0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]);

function du(t) {
    t.gestures = [], t.landmarks = [], t.worldLandmarks = [], t.handedness = []
}

function pu(t) {
    return t.gestures.length === 0 ? {
        gestures: [],
        landmarks: [],
        worldLandmarks: [],
        handedness: [],
        handednesses: []
    } : {
        gestures: t.gestures,
        landmarks: t.landmarks,
        worldLandmarks: t.worldLandmarks,
        handedness: t.handedness,
        handednesses: t.handedness
    }
}

function gu(t, e = !0) {
    const n = [];
    for (const r of t) {
        var s = Ti(r);
        t = [];
        for (const i of s.g()) s = e && Zt(i, 1) != null ? Zt(i, 1) ?? 0 : -1, t.push({
            score: $e(i, 2) ?? 0,
            index: s,
            categoryName: Qt(i, 3) ?? "" ?? "",
            displayName: Qt(i, 4) ?? "" ?? ""
        });
        n.push(t)
    }
    return n
}
var Ft = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !1), this.gestures = [], this.landmarks = [], this.worldLandmarks = [], this.handedness = [], pe(t = this.j = new m1, 0, 1, e = new ze), this.s = new ya, pe(this.j, 0, 2, this.s), this.C = new ma, pe(this.s, 0, 3, this.C), this.v = new g1, pe(this.s, 0, 2, this.v), this.h = new G2, pe(this.j, 0, 3, this.h), ae(this.v, 2, .5), ae(this.s, 4, .5), ae(this.C, 2, .5)
    }
    get baseOptions() {
        return Ee(this.j, ze, 1)
    }
    set baseOptions(t) {
        pe(this.j, 0, 1, t)
    }
    o(t) {
        var r, i, o, c;
        if (wn(this.v, 3, t.numHands ?? 1), "minHandDetectionConfidence" in t && ae(this.v, 2, t.minHandDetectionConfidence ?? .5), "minTrackingConfidence" in t && ae(this.s, 4, t.minTrackingConfidence ?? .5), "minHandPresenceConfidence" in t && ae(this.C, 2, t.minHandPresenceConfidence ?? .5), t.cannedGesturesClassifierOptions) {
            var e = new hs,
                n = e,
                s = _o(t.cannedGesturesClassifierOptions, (r = Ee(this.h, hs, 3)) == null ? void 0 : r.h());
            pe(n, 0, 2, s), pe(this.h, 0, 3, e)
        } else t.cannedGesturesClassifierOptions === void 0 && ((i = Ee(this.h, hs, 3)) == null || i.g());
        return t.customGesturesClassifierOptions ? (pe(n = e = new hs, 0, 2, s = _o(t.customGesturesClassifierOptions, (o = Ee(this.h, hs, 4)) == null ? void 0 : o.h())), pe(this.h, 0, 4, e)) : t.customGesturesClassifierOptions === void 0 && ((c = Ee(this.h, hs, 4)) == null || c.g()), this.l(t)
    }
    Fa(t, e) {
        return du(this), tn(this, t, e), pu(this)
    }
    Ga(t, e, n) {
        return du(this), vn(this, t, n, e), pu(this)
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect"), Se(t, "hand_gestures"), Se(t, "hand_landmarks"), Se(t, "world_hand_landmarks"), Se(t, "handedness");
        const e = new jt;
        an(e, V2, this.j);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.gesture_recognizer.GestureRecognizerGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "HAND_GESTURES:hand_gestures"), xe(n, "LANDMARKS:hand_landmarks"), xe(n, "WORLD_LANDMARKS:world_hand_landmarks"), xe(n, "HANDEDNESS:handedness"), n.o(e), Wt(t, n), this.g.attachProtoVectorListener("hand_landmarks", (s, r) => {
            for (const i of s) {
                s = dr(i);
                const o = [];
                for (const c of Pn(s, i1, 1)) o.push({
                    x: $e(c, 1) ?? 0,
                    y: $e(c, 2) ?? 0,
                    z: $e(c, 3) ?? 0,
                    visibility: $e(c, 4) ?? 0
                });
                this.landmarks.push(o)
            }
            re(this, r)
        }), this.g.attachEmptyPacketListener("hand_landmarks", s => {
            re(this, s)
        }), this.g.attachProtoVectorListener("world_hand_landmarks", (s, r) => {
            for (const i of s) {
                s = bs(i);
                const o = [];
                for (const c of Pn(s, r1, 1)) o.push({
                    x: $e(c, 1) ?? 0,
                    y: $e(c, 2) ?? 0,
                    z: $e(c, 3) ?? 0,
                    visibility: $e(c, 4) ?? 0
                });
                this.worldLandmarks.push(o)
            }
            re(this, r)
        }), this.g.attachEmptyPacketListener("world_hand_landmarks", s => {
            re(this, s)
        }), this.g.attachProtoVectorListener("hand_gestures", (s, r) => {
            this.gestures.push(...gu(s, !1)), re(this, r)
        }), this.g.attachEmptyPacketListener("hand_gestures", s => {
            re(this, s)
        }), this.g.attachProtoVectorListener("handedness", (s, r) => {
            this.handedness.push(...gu(s)), re(this, r)
        }), this.g.attachEmptyPacketListener("handedness", s => {
            re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};

function mu(t) {
    return {
        landmarks: t.landmarks,
        worldLandmarks: t.worldLandmarks,
        handednesses: t.handedness,
        handedness: t.handedness
    }
}
Ft.prototype.recognizeForVideo = Ft.prototype.Ga, Ft.prototype.recognize = Ft.prototype.Fa, Ft.prototype.setOptions = Ft.prototype.o, Ft.createFromModelPath = function (t, e) {
    return be(Ft, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Ft.createFromModelBuffer = function (t, e) {
    return be(Ft, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Ft.createFromOptions = function (t, e) {
    return be(Ft, t, e)
}, Ft.HAND_CONNECTIONS = La;
var Ct = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !1), this.landmarks = [], this.worldLandmarks = [], this.handedness = [], pe(t = this.h = new ya, 0, 1, e = new ze), this.s = new ma, pe(this.h, 0, 3, this.s), this.j = new g1, pe(this.h, 0, 2, this.j), wn(this.j, 3, 1), ae(this.j, 2, .5), ae(this.s, 2, .5), ae(this.h, 4, .5)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return "numHands" in t && wn(this.j, 3, t.numHands ?? 1), "minHandDetectionConfidence" in t && ae(this.j, 2, t.minHandDetectionConfidence ?? .5), "minTrackingConfidence" in t && ae(this.h, 4, t.minTrackingConfidence ?? .5), "minHandPresenceConfidence" in t && ae(this.s, 2, t.minHandPresenceConfidence ?? .5), this.l(t)
    }
    D(t, e) {
        return this.landmarks = [], this.worldLandmarks = [], this.handedness = [], tn(this, t, e), mu(this)
    }
    F(t, e, n) {
        return this.landmarks = [], this.worldLandmarks = [], this.handedness = [], vn(this, t, n, e), mu(this)
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect"), Se(t, "hand_landmarks"), Se(t, "world_hand_landmarks"), Se(t, "handedness");
        const e = new jt;
        an(e, z2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.hand_landmarker.HandLandmarkerGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "LANDMARKS:hand_landmarks"), xe(n, "WORLD_LANDMARKS:world_hand_landmarks"), xe(n, "HANDEDNESS:handedness"), n.o(e), Wt(t, n), this.g.attachProtoVectorListener("hand_landmarks", (s, r) => {
            for (const i of s) s = dr(i), this.landmarks.push(Mi(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("hand_landmarks", s => {
            re(this, s)
        }), this.g.attachProtoVectorListener("world_hand_landmarks", (s, r) => {
            for (const i of s) s = bs(i), this.worldLandmarks.push(er(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("world_hand_landmarks", s => {
            re(this, s)
        }), this.g.attachProtoVectorListener("handedness", (s, r) => {
            var i = this.handedness,
                o = i.push;
            const c = [];
            for (const f of s) {
                s = Ti(f);
                const _ = [];
                for (const M of s.g()) _.push({
                    score: $e(M, 2) ?? 0,
                    index: Zt(M, 1) ?? 0 ?? -1,
                    categoryName: Qt(M, 3) ?? "" ?? "",
                    displayName: Qt(M, 4) ?? "" ?? ""
                });
                c.push(_)
            }
            o.call(i, ...c), re(this, r)
        }), this.g.attachEmptyPacketListener("handedness", s => {
            re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
Ct.prototype.detectForVideo = Ct.prototype.F, Ct.prototype.detect = Ct.prototype.D, Ct.prototype.setOptions = Ct.prototype.o, Ct.createFromModelPath = function (t, e) {
    return be(Ct, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Ct.createFromModelBuffer = function (t, e) {
    return be(Ct, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Ct.createFromOptions = function (t, e) {
    return be(Ct, t, e)
}, Ct.HAND_CONNECTIONS = La;
var z1 = ln([0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]);

function yu(t) {
    t.h = {
        faceLandmarks: [],
        faceBlendshapes: [],
        poseLandmarks: [],
        poseWorldLandmarks: [],
        poseSegmentationMasks: [],
        leftHandLandmarks: [],
        leftHandWorldLandmarks: [],
        rightHandLandmarks: [],
        rightHandWorldLandmarks: []
    }
}

function _u(t) {
    try {
        if (!t.C) return t.h;
        t.C(t.h)
    } finally {
        Pi(t)
    }
}

function Or(t, e) {
    t = dr(t), e.push(Mi(t))
}
var De = class extends It {
    constructor(t, e) {
        super(new en(t, e), "input_frames_image", null, !1), this.h = {
            faceLandmarks: [],
            faceBlendshapes: [],
            poseLandmarks: [],
            poseWorldLandmarks: [],
            poseSegmentationMasks: [],
            leftHandLandmarks: [],
            leftHandWorldLandmarks: [],
            rightHandLandmarks: [],
            rightHandWorldLandmarks: []
        }, this.outputPoseSegmentationMasks = this.outputFaceBlendshapes = !1, pe(t = this.j = new b1, 0, 1, e = new ze), this.K = new ma, pe(this.j, 0, 2, this.K), this.Y = new j2, pe(this.j, 0, 3, this.Y), this.s = new Si, pe(this.j, 0, 4, this.s), this.H = new l1, pe(this.j, 0, 5, this.H), this.v = new w1, pe(this.j, 0, 6, this.v), this.L = new v1, pe(this.j, 0, 7, this.L), ae(this.s, 2, .5), ae(this.s, 3, .3), ae(this.H, 2, .5), ae(this.v, 2, .5), ae(this.v, 3, .3), ae(this.L, 2, .5), ae(this.K, 2, .5)
    }
    get baseOptions() {
        return Ee(this.j, ze, 1)
    }
    set baseOptions(t) {
        pe(this.j, 0, 1, t)
    }
    o(t) {
        return "minFaceDetectionConfidence" in t && ae(this.s, 2, t.minFaceDetectionConfidence ?? .5), "minFaceSuppressionThreshold" in t && ae(this.s, 3, t.minFaceSuppressionThreshold ?? .3), "minFacePresenceConfidence" in t && ae(this.H, 2, t.minFacePresenceConfidence ?? .5), "outputFaceBlendshapes" in t && (this.outputFaceBlendshapes = !!t.outputFaceBlendshapes), "minPoseDetectionConfidence" in t && ae(this.v, 2, t.minPoseDetectionConfidence ?? .5), "minPoseSuppressionThreshold" in t && ae(this.v, 3, t.minPoseSuppressionThreshold ?? .3), "minPosePresenceConfidence" in t && ae(this.L, 2, t.minPosePresenceConfidence ?? .5), "outputPoseSegmentationMasks" in t && (this.outputPoseSegmentationMasks = !!t.outputPoseSegmentationMasks), "minHandLandmarksConfidence" in t && ae(this.K, 2, t.minHandLandmarksConfidence ?? .5), this.l(t)
    }
    D(t, e, n) {
        const s = typeof e != "function" ? e : {};
        return this.C = typeof e == "function" ? e : n, yu(this), tn(this, t, s), _u(this)
    }
    F(t, e, n, s) {
        const r = typeof n != "function" ? n : {};
        return this.C = typeof n == "function" ? n : s, yu(this), vn(this, t, r, e), _u(this)
    }
    m() {
        var t = new Ot;
        Ce(t, "input_frames_image"), Se(t, "pose_landmarks"), Se(t, "pose_world_landmarks"), Se(t, "face_landmarks"), Se(t, "left_hand_landmarks"), Se(t, "left_hand_world_landmarks"), Se(t, "right_hand_landmarks"), Se(t, "right_hand_world_landmarks");
        const e = new jt,
            n = new Vc;
        fo(n, 1, Us("type.googleapis.com/mediapipe.tasks.vision.holistic_landmarker.proto.HolisticLandmarkerGraphOptions"), ""),
            function (r, i) {
                if (i != null)
                    if (Array.isArray(i)) Ne(r, 2, hi(i, qo, void 0, void 0, !1));
                    else {
                        if (!(typeof i == "string" || i instanceof Sn || os(i))) throw Error("invalid value in Any.value field: " + i + " expected a ByteString, a base64 encoded string, a Uint8Array or a jspb array");
                        fo(r, 2, Fo(i, !1), as())
                    }
            }(n, this.j.g());
        const s = new Et;
        qt(s, "mediapipe.tasks.vision.holistic_landmarker.HolisticLandmarkerGraph"), $r(s, 8, Vc, n), Ue(s, "IMAGE:input_frames_image"), xe(s, "POSE_LANDMARKS:pose_landmarks"), xe(s, "POSE_WORLD_LANDMARKS:pose_world_landmarks"), xe(s, "FACE_LANDMARKS:face_landmarks"), xe(s, "LEFT_HAND_LANDMARKS:left_hand_landmarks"), xe(s, "LEFT_HAND_WORLD_LANDMARKS:left_hand_world_landmarks"), xe(s, "RIGHT_HAND_LANDMARKS:right_hand_landmarks"), xe(s, "RIGHT_HAND_WORLD_LANDMARKS:right_hand_world_landmarks"), s.o(e), Wt(t, s), Ri(this, t), this.g.attachProtoListener("pose_landmarks", (r, i) => {
            Or(r, this.h.poseLandmarks), re(this, i)
        }), this.g.attachEmptyPacketListener("pose_landmarks", r => {
            re(this, r)
        }), this.g.attachProtoListener("pose_world_landmarks", (r, i) => {
            var o = this.h.poseWorldLandmarks;
            r = bs(r), o.push(er(r)), re(this, i)
        }), this.g.attachEmptyPacketListener("pose_world_landmarks", r => {
            re(this, r)
        }), this.outputPoseSegmentationMasks && (xe(s, "POSE_SEGMENTATION_MASK:pose_segmentation_mask"), Ps(this, "pose_segmentation_mask"), this.g.V("pose_segmentation_mask", (r, i) => {
            this.h.poseSegmentationMasks = [Os(this, r, !0, !this.C)], re(this, i)
        }), this.g.attachEmptyPacketListener("pose_segmentation_mask", r => {
            this.h.poseSegmentationMasks = [], re(this, r)
        })), this.g.attachProtoListener("face_landmarks", (r, i) => {
            Or(r, this.h.faceLandmarks), re(this, i)
        }), this.g.attachEmptyPacketListener("face_landmarks", r => {
            re(this, r)
        }), this.outputFaceBlendshapes && (Se(t, "extra_blendshapes"), xe(s, "FACE_BLENDSHAPES:extra_blendshapes"), this.g.attachProtoListener("extra_blendshapes", (r, i) => {
            var o = this.h.faceBlendshapes;
            this.outputFaceBlendshapes && (r = Ti(r), o.push(ba(r.g() ?? []))), re(this, i)
        }), this.g.attachEmptyPacketListener("extra_blendshapes", r => {
            re(this, r)
        })), this.g.attachProtoListener("left_hand_landmarks", (r, i) => {
            Or(r, this.h.leftHandLandmarks), re(this, i)
        }), this.g.attachEmptyPacketListener("left_hand_landmarks", r => {
            re(this, r)
        }), this.g.attachProtoListener("left_hand_world_landmarks", (r, i) => {
            var o = this.h.leftHandWorldLandmarks;
            r = bs(r), o.push(er(r)), re(this, i)
        }), this.g.attachEmptyPacketListener("left_hand_world_landmarks", r => {
            re(this, r)
        }), this.g.attachProtoListener("right_hand_landmarks", (r, i) => {
            Or(r, this.h.rightHandLandmarks), re(this, i)
        }), this.g.attachEmptyPacketListener("right_hand_landmarks", r => {
            re(this, r)
        }), this.g.attachProtoListener("right_hand_world_landmarks", (r, i) => {
            var o = this.h.rightHandWorldLandmarks;
            r = bs(r), o.push(er(r)), re(this, i)
        }), this.g.attachEmptyPacketListener("right_hand_world_landmarks", r => {
            re(this, r)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
De.prototype.detectForVideo = De.prototype.F, De.prototype.detect = De.prototype.D, De.prototype.setOptions = De.prototype.o, De.createFromModelPath = function (t, e) {
    return be(De, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, De.createFromModelBuffer = function (t, e) {
    return be(De, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, De.createFromOptions = function (t, e) {
    return be(De, t, e)
}, De.HAND_CONNECTIONS = La, De.POSE_CONNECTIONS = z1, De.FACE_LANDMARKS_LIPS = Ma, De.FACE_LANDMARKS_LEFT_EYE = Ra, De.FACE_LANDMARKS_LEFT_EYEBROW = Pa, De.FACE_LANDMARKS_LEFT_IRIS = C1, De.FACE_LANDMARKS_RIGHT_EYE = Ba, De.FACE_LANDMARKS_RIGHT_EYEBROW = Ia, De.FACE_LANDMARKS_RIGHT_IRIS = D1, De.FACE_LANDMARKS_FACE_OVAL = Oa, De.FACE_LANDMARKS_CONTOURS = G1, De.FACE_LANDMARKS_TESSELATION = V1;
var $t = class extends It {
    constructor(t, e) {
        super(new en(t, e), "input_image", "norm_rect", !0), this.j = {
            classifications: []
        }, pe(t = this.h = new x1, 0, 1, e = new ze)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return pe(this.h, 0, 2, _o(t, Ee(this.h, da, 2))), this.l(t)
    }
    qa(t, e) {
        return this.j = {
            classifications: []
        }, tn(this, t, e), this.j
    }
    ra(t, e, n) {
        return this.j = {
            classifications: []
        }, vn(this, t, n, e), this.j
    }
    m() {
        var t = new Ot;
        Ce(t, "input_image"), Ce(t, "norm_rect"), Se(t, "classifications");
        const e = new jt;
        an(e, H2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.image_classifier.ImageClassifierGraph"), Ue(n, "IMAGE:input_image"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "CLASSIFICATIONS:classifications"), n.o(e), Wt(t, n), this.g.attachProtoListener("classifications", (s, r) => {
            this.j = function (i) {
                const o = {
                    classifications: Pn(i, B2, 1).map(c => {
                        var f;
                        return ba(((f = Ee(c, t1, 4)) == null ? void 0 : f.g()) ?? [], Zt(c, 2) ?? 0, Qt(c, 3) ?? "")
                    })
                };
                return co(Ms(i, 2)) != null && (o.timestampMs = co(Ms(i, 2)) ?? 0), o
            }(I2(s)), re(this, r)
        }), this.g.attachEmptyPacketListener("classifications", s => {
            re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
$t.prototype.classifyForVideo = $t.prototype.ra, $t.prototype.classify = $t.prototype.qa, $t.prototype.setOptions = $t.prototype.o, $t.createFromModelPath = function (t, e) {
    return be($t, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, $t.createFromModelBuffer = function (t, e) {
    return be($t, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, $t.createFromOptions = function (t, e) {
    return be($t, t, e)
};
var Dt = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !0), this.h = new E1, this.embeddings = {
            embeddings: []
        }, pe(t = this.h, 0, 1, e = new ze)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        var e = this.h,
            n = Ee(this.h, Kc, 2);
        return n = n ? n.clone() : new Kc, t.l2Normalize !== void 0 ? cr(n, 1, t.l2Normalize) : "l2Normalize" in t && Ne(n, 1), t.quantize !== void 0 ? cr(n, 2, t.quantize) : "quantize" in t && Ne(n, 2), pe(e, 0, 2, n), this.l(t)
    }
    xa(t, e) {
        return tn(this, t, e), this.embeddings
    }
    ya(t, e, n) {
        return vn(this, t, n, e), this.embeddings
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect"), Se(t, "embeddings_out");
        const e = new jt;
        an(e, q2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.image_embedder.ImageEmbedderGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "EMBEDDINGS:embeddings_out"), n.o(e), Wt(t, n), this.g.attachProtoListener("embeddings_out", (s, r) => {
            s = N2(s), this.embeddings = function (i) {
                return {
                    embeddings: Pn(i, L2, 1).map(o => {
                        var f, _;
                        const c = {
                            headIndex: Zt(o, 3) ?? 0 ?? -1,
                            headName: Qt(o, 4) ?? "" ?? ""
                        };
                        if (bl(o, Xc, Vi(o, 1)) !== void 0) o = es(o = Ee(o, Xc, Vi(o, 1)), 1, Yn, Qn()), c.floatEmbedding = o.slice();
                        else {
                            const M = new Uint8Array(0);
                            c.quantizedEmbedding = ((_ = (f = Ee(o, O2, Vi(o, 2))) == null ? void 0 : f.ma()) == null ? void 0 : _.h()) ?? M
                        }
                        return c
                    }),
                    timestampMs: co(Ms(i, 2)) ?? 0
                }
            }(s), re(this, r)
        }), this.g.attachEmptyPacketListener("embeddings_out", s => {
            re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
Dt.cosineSimilarity = function (t, e) {
    if (t.floatEmbedding && e.floatEmbedding) t = tu(t.floatEmbedding, e.floatEmbedding);
    else {
        if (!t.quantizedEmbedding || !e.quantizedEmbedding) throw Error("Cannot compute cosine similarity between quantized and float embeddings.");
        t = tu(eu(t.quantizedEmbedding), eu(e.quantizedEmbedding))
    }
    return t
}, Dt.prototype.embedForVideo = Dt.prototype.ya, Dt.prototype.embed = Dt.prototype.xa, Dt.prototype.setOptions = Dt.prototype.o, Dt.createFromModelPath = function (t, e) {
    return be(Dt, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Dt.createFromModelBuffer = function (t, e) {
    return be(Dt, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Dt.createFromOptions = function (t, e) {
    return be(Dt, t, e)
};
var xo = class {
    constructor(t, e, n) {
        this.confidenceMasks = t, this.categoryMask = e, this.qualityScores = n
    }
    close() {
        var t, e;
        (t = this.confidenceMasks) == null || t.forEach(n => {
            n.close()
        }), (e = this.categoryMask) == null || e.close()
    }
};

function wu(t) {
    t.categoryMask = void 0, t.confidenceMasks = void 0, t.qualityScores = void 0
}

function vu(t) {
    try {
        const e = new xo(t.confidenceMasks, t.categoryMask, t.qualityScores);
        if (!t.j) return e;
        t.j(e)
    } finally {
        Pi(t)
    }
}
xo.prototype.close = xo.prototype.close;
var Rt = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !1), this.s = [], this.outputCategoryMask = !1, this.outputConfidenceMasks = !0, this.h = new va, this.v = new A1, pe(this.h, 0, 3, this.v), pe(t = this.h, 0, 1, e = new ze)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return t.displayNamesLocale !== void 0 ? Ne(this.h, 2, Us(t.displayNamesLocale)) : "displayNamesLocale" in t && Ne(this.h, 2), "outputCategoryMask" in t && (this.outputCategoryMask = t.outputCategoryMask ?? !1), "outputConfidenceMasks" in t && (this.outputConfidenceMasks = t.outputConfidenceMasks ?? !0), super.l(t)
    }
    J() {
        (function (t) {
            var n, s;
            const e = Pn(t.ca(), Et, 1).filter(r => (Qt(r, 1) ?? "").includes("mediapipe.tasks.TensorsToSegmentationCalculator"));
            if (t.s = [], e.length > 1) throw Error("The graph has more than one mediapipe.tasks.TensorsToSegmentationCalculator.");
            e.length === 1 && (((s = (n = Ee(e[0], jt, 7)) == null ? void 0 : n.l()) == null ? void 0 : s.g()) ?? new Map).forEach((r, i) => {
                t.s[Number(i)] = Qt(r, 1) ?? ""
            })
        })(this)
    }
    segment(t, e, n) {
        const s = typeof e != "function" ? e : {};
        return this.j = typeof e == "function" ? e : n, wu(this), tn(this, t, s), vu(this)
    }
    Ia(t, e, n, s) {
        const r = typeof n != "function" ? n : {};
        return this.j = typeof n == "function" ? n : s, wu(this), vn(this, t, r, e), vu(this)
    }
    Ba() {
        return this.s
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect");
        const e = new jt;
        an(e, S1, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.image_segmenter.ImageSegmenterGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), n.o(e), Wt(t, n), Ri(this, t), this.outputConfidenceMasks && (Se(t, "confidence_masks"), xe(n, "CONFIDENCE_MASKS:confidence_masks"), Ps(this, "confidence_masks"), this.g.ba("confidence_masks", (s, r) => {
            this.confidenceMasks = s.map(i => Os(this, i, !0, !this.j)), re(this, r)
        }), this.g.attachEmptyPacketListener("confidence_masks", s => {
            this.confidenceMasks = [], re(this, s)
        })), this.outputCategoryMask && (Se(t, "category_mask"), xe(n, "CATEGORY_MASK:category_mask"), Ps(this, "category_mask"), this.g.V("category_mask", (s, r) => {
            this.categoryMask = Os(this, s, !1, !this.j), re(this, r)
        }), this.g.attachEmptyPacketListener("category_mask", s => {
            this.categoryMask = void 0, re(this, s)
        })), Se(t, "quality_scores"), xe(n, "QUALITY_SCORES:quality_scores"), this.g.attachFloatVectorListener("quality_scores", (s, r) => {
            this.qualityScores = s, re(this, r)
        }), this.g.attachEmptyPacketListener("quality_scores", s => {
            this.categoryMask = void 0, re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
Rt.prototype.getLabels = Rt.prototype.Ba, Rt.prototype.segmentForVideo = Rt.prototype.Ia, Rt.prototype.segment = Rt.prototype.segment, Rt.prototype.setOptions = Rt.prototype.o, Rt.createFromModelPath = function (t, e) {
    return be(Rt, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Rt.createFromModelBuffer = function (t, e) {
    return be(Rt, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Rt.createFromOptions = function (t, e) {
    return be(Rt, t, e)
};
var Eo = class {
    constructor(t, e, n) {
        this.confidenceMasks = t, this.categoryMask = e, this.qualityScores = n
    }
    close() {
        var t, e;
        (t = this.confidenceMasks) == null || t.forEach(n => {
            n.close()
        }), (e = this.categoryMask) == null || e.close()
    }
};
Eo.prototype.close = Eo.prototype.close;
var Q2 = class extends oe {
    constructor(t) {
        super(t)
    }
},
    ds = [0, Ye, -2],
    Zr = [0, xn, -3, Ve, xn, -1],
    bu = [0, Zr],
    xu = [0, Zr, Ye, -1],
    Yi = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Eu = [0, xn, -1, Ve],
    ed = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Au = class extends oe {
        constructor(t) {
            super(t)
        }
    },
    Ao = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15],
    j1 = class extends oe {
        constructor(t) {
            super(t)
        }
    };
j1.prototype.g = Ai([0, st, [0, Ao, Pe, Zr, Pe, [0, Zr, ds], Pe, bu, Pe, [0, bu, ds], Pe, Eu, Pe, [0, xn, -3, Ve, Vt], Pe, [0, xn, -3, Ve], Pe, [0, Be, xn, -2, Ve, Ye, Ve, -1, 2, xn, ds], Pe, xu, Pe, [0, xu, ds], xn, ds, Be, Pe, [0, xn, -3, Ve, ds, -1], Pe, [0, st, Eu]], Be, [0, Be, Ye, -1, Ve]]);
var pn = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect_in", !1), this.outputCategoryMask = !1, this.outputConfidenceMasks = !0, this.h = new va, this.s = new A1, pe(this.h, 0, 3, this.s), pe(t = this.h, 0, 1, e = new ze)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return "outputCategoryMask" in t && (this.outputCategoryMask = t.outputCategoryMask ?? !1), "outputConfidenceMasks" in t && (this.outputConfidenceMasks = t.outputConfidenceMasks ?? !0), super.l(t)
    }
    segment(t, e, n, s) {
        const r = typeof n != "function" ? n : {};
        this.j = typeof n == "function" ? n : s, this.qualityScores = this.categoryMask = this.confidenceMasks = void 0, n = this.B + 1, s = new j1;
        const i = new Au;
        var o = new Q2;
        if (wn(o, 1, 255), pe(i, 0, 12, o), e.keypoint && e.scribble) throw Error("Cannot provide both keypoint and scribble.");
        if (e.keypoint) {
            var c = new Yi;
            cr(c, 3, !0), ae(c, 1, e.keypoint.x), ae(c, 2, e.keypoint.y), Zs(i, 5, Ao, c)
        } else {
            if (!e.scribble) throw Error("Must provide either a keypoint or a scribble.");
            for (c of (o = new ed, e.scribble)) cr(e = new Yi, 3, !0), ae(e, 1, c.x), ae(e, 2, c.y), $r(o, 1, Yi, e);
            Zs(i, 15, Ao, o)
        }
        $r(s, 1, Au, i), this.g.addProtoToStream(s.g(), "drishti.RenderData", "roi_in", n), tn(this, t, r);
        e: {
            try {
                const _ = new Eo(this.confidenceMasks, this.categoryMask, this.qualityScores);
                if (!this.j) {
                    var f = _;
                    break e
                }
                this.j(_)
            } finally {
                Pi(this)
            }
            f = void 0
        }
        return f
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "roi_in"), Ce(t, "norm_rect_in");
        const e = new jt;
        an(e, S1, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.interactive_segmenter.InteractiveSegmenterGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "ROI:roi_in"), Ue(n, "NORM_RECT:norm_rect_in"), n.o(e), Wt(t, n), Ri(this, t), this.outputConfidenceMasks && (Se(t, "confidence_masks"), xe(n, "CONFIDENCE_MASKS:confidence_masks"), Ps(this, "confidence_masks"), this.g.ba("confidence_masks", (s, r) => {
            this.confidenceMasks = s.map(i => Os(this, i, !0, !this.j)), re(this, r)
        }), this.g.attachEmptyPacketListener("confidence_masks", s => {
            this.confidenceMasks = [], re(this, s)
        })), this.outputCategoryMask && (Se(t, "category_mask"), xe(n, "CATEGORY_MASK:category_mask"), Ps(this, "category_mask"), this.g.V("category_mask", (s, r) => {
            this.categoryMask = Os(this, s, !1, !this.j), re(this, r)
        }), this.g.attachEmptyPacketListener("category_mask", s => {
            this.categoryMask = void 0, re(this, s)
        })), Se(t, "quality_scores"), xe(n, "QUALITY_SCORES:quality_scores"), this.g.attachFloatVectorListener("quality_scores", (s, r) => {
            this.qualityScores = s, re(this, r)
        }), this.g.attachEmptyPacketListener("quality_scores", s => {
            this.categoryMask = void 0, re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
pn.prototype.segment = pn.prototype.segment, pn.prototype.setOptions = pn.prototype.o, pn.createFromModelPath = function (t, e) {
    return be(pn, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, pn.createFromModelBuffer = function (t, e) {
    return be(pn, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, pn.createFromOptions = function (t, e) {
    return be(pn, t, e)
};
var Xt = class extends It {
    constructor(t, e) {
        super(new en(t, e), "input_frame_gpu", "norm_rect", !1), this.j = {
            detections: []
        }, pe(t = this.h = new M1, 0, 1, e = new ze)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return t.displayNamesLocale !== void 0 ? Ne(this.h, 2, Us(t.displayNamesLocale)) : "displayNamesLocale" in t && Ne(this.h, 2), t.maxResults !== void 0 ? wn(this.h, 3, t.maxResults) : "maxResults" in t && Ne(this.h, 3), t.scoreThreshold !== void 0 ? ae(this.h, 4, t.scoreThreshold) : "scoreThreshold" in t && Ne(this.h, 4), t.categoryAllowlist !== void 0 ? Xr(this.h, 5, t.categoryAllowlist) : "categoryAllowlist" in t && Ne(this.h, 5), t.categoryDenylist !== void 0 ? Xr(this.h, 6, t.categoryDenylist) : "categoryDenylist" in t && Ne(this.h, 6), this.l(t)
    }
    D(t, e) {
        return this.j = {
            detections: []
        }, tn(this, t, e), this.j
    }
    F(t, e, n) {
        return this.j = {
            detections: []
        }, vn(this, t, n, e), this.j
    }
    m() {
        var t = new Ot;
        Ce(t, "input_frame_gpu"), Ce(t, "norm_rect"), Se(t, "detections");
        const e = new jt;
        an(e, Y2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.ObjectDetectorGraph"), Ue(n, "IMAGE:input_frame_gpu"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "DETECTIONS:detections"), n.o(e), Wt(t, n), this.g.attachProtoVectorListener("detections", (s, r) => {
            for (const i of s) s = s1(i), this.j.detections.push(P1(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("detections", s => {
            re(this, s)
        }), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
Xt.prototype.detectForVideo = Xt.prototype.F, Xt.prototype.detect = Xt.prototype.D, Xt.prototype.setOptions = Xt.prototype.o, Xt.createFromModelPath = async function (t, e) {
    return be(Xt, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Xt.createFromModelBuffer = function (t, e) {
    return be(Xt, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Xt.createFromOptions = function (t, e) {
    return be(Xt, t, e)
};
var To = class {
    constructor(t, e, n) {
        this.landmarks = t, this.worldLandmarks = e, this.segmentationMasks = n
    }
    close() {
        var t;
        (t = this.segmentationMasks) == null || t.forEach(e => {
            e.close()
        })
    }
};

function Tu(t) {
    t.landmarks = [], t.worldLandmarks = [], t.segmentationMasks = void 0
}

function Su(t) {
    try {
        const e = new To(t.landmarks, t.worldLandmarks, t.segmentationMasks);
        if (!t.s) return e;
        t.s(e)
    } finally {
        Pi(t)
    }
}
To.prototype.close = To.prototype.close;
var Gt = class extends It {
    constructor(t, e) {
        super(new en(t, e), "image_in", "norm_rect", !1), this.landmarks = [], this.worldLandmarks = [], this.outputSegmentationMasks = !1, pe(t = this.h = new R1, 0, 1, e = new ze), this.v = new v1, pe(this.h, 0, 3, this.v), this.j = new w1, pe(this.h, 0, 2, this.j), wn(this.j, 4, 1), ae(this.j, 2, .5), ae(this.v, 2, .5), ae(this.h, 4, .5)
    }
    get baseOptions() {
        return Ee(this.h, ze, 1)
    }
    set baseOptions(t) {
        pe(this.h, 0, 1, t)
    }
    o(t) {
        return "numPoses" in t && wn(this.j, 4, t.numPoses ?? 1), "minPoseDetectionConfidence" in t && ae(this.j, 2, t.minPoseDetectionConfidence ?? .5), "minTrackingConfidence" in t && ae(this.h, 4, t.minTrackingConfidence ?? .5), "minPosePresenceConfidence" in t && ae(this.v, 2, t.minPosePresenceConfidence ?? .5), "outputSegmentationMasks" in t && (this.outputSegmentationMasks = t.outputSegmentationMasks ?? !1), this.l(t)
    }
    D(t, e, n) {
        const s = typeof e != "function" ? e : {};
        return this.s = typeof e == "function" ? e : n, Tu(this), tn(this, t, s), Su(this)
    }
    F(t, e, n, s) {
        const r = typeof n != "function" ? n : {};
        return this.s = typeof n == "function" ? n : s, Tu(this), vn(this, t, r, e), Su(this)
    }
    m() {
        var t = new Ot;
        Ce(t, "image_in"), Ce(t, "norm_rect"), Se(t, "normalized_landmarks"), Se(t, "world_landmarks"), Se(t, "segmentation_masks");
        const e = new jt;
        an(e, $2, this.h);
        const n = new Et;
        qt(n, "mediapipe.tasks.vision.pose_landmarker.PoseLandmarkerGraph"), Ue(n, "IMAGE:image_in"), Ue(n, "NORM_RECT:norm_rect"), xe(n, "NORM_LANDMARKS:normalized_landmarks"), xe(n, "WORLD_LANDMARKS:world_landmarks"), n.o(e), Wt(t, n), Ri(this, t), this.g.attachProtoVectorListener("normalized_landmarks", (s, r) => {
            this.landmarks = [];
            for (const i of s) s = dr(i), this.landmarks.push(Mi(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("normalized_landmarks", s => {
            this.landmarks = [], re(this, s)
        }), this.g.attachProtoVectorListener("world_landmarks", (s, r) => {
            this.worldLandmarks = [];
            for (const i of s) s = bs(i), this.worldLandmarks.push(er(s));
            re(this, r)
        }), this.g.attachEmptyPacketListener("world_landmarks", s => {
            this.worldLandmarks = [], re(this, s)
        }), this.outputSegmentationMasks && (xe(n, "SEGMENTATION_MASK:segmentation_masks"), Ps(this, "segmentation_masks"), this.g.ba("segmentation_masks", (s, r) => {
            this.segmentationMasks = s.map(i => Os(this, i, !0, !this.s)), re(this, r)
        }), this.g.attachEmptyPacketListener("segmentation_masks", s => {
            this.segmentationMasks = [], re(this, s)
        })), t = t.g(), this.setGraph(new Uint8Array(t), !0)
    }
};
Gt.prototype.detectForVideo = Gt.prototype.F, Gt.prototype.detect = Gt.prototype.D, Gt.prototype.setOptions = Gt.prototype.o, Gt.createFromModelPath = function (t, e) {
    return be(Gt, t, {
        baseOptions: {
            modelAssetPath: e
        }
    })
}, Gt.createFromModelBuffer = function (t, e) {
    return be(Gt, t, {
        baseOptions: {
            modelAssetBuffer: e
        }
    })
}, Gt.createFromOptions = function (t, e) {
    return be(Gt, t, e)
}, Gt.POSE_CONNECTIONS = z1;
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const td = [127, 34, 139, 11, 0, 37, 232, 231, 120, 72, 37, 39, 128, 121, 47, 232, 121, 128, 104, 69, 67, 175, 171, 148, 157, 154, 155, 118, 50, 101, 73, 39, 40, 9, 151, 108, 48, 115, 131, 194, 204, 211, 74, 40, 185, 80, 42, 183, 40, 92, 186, 230, 229, 118, 202, 212, 214, 83, 18, 17, 76, 61, 146, 160, 29, 30, 56, 157, 173, 106, 204, 194, 135, 214, 192, 203, 165, 98, 21, 71, 68, 51, 45, 4, 144, 24, 23, 77, 146, 91, 205, 50, 187, 201, 200, 18, 91, 106, 182, 90, 91, 181, 85, 84, 17, 206, 203, 36, 148, 171, 140, 92, 40, 39, 193, 189, 244, 159, 158, 28, 247, 246, 161, 236, 3, 196, 54, 68, 104, 193, 168, 8, 117, 228, 31, 189, 193, 55, 98, 97, 99, 126, 47, 100, 166, 79, 218, 155, 154, 26, 209, 49, 131, 135, 136, 150, 47, 126, 217, 223, 52, 53, 45, 51, 134, 211, 170, 140, 67, 69, 108, 43, 106, 91, 230, 119, 120, 226, 130, 247, 63, 53, 52, 238, 20, 242, 46, 70, 156, 78, 62, 96, 46, 53, 63, 143, 34, 227, 173, 155, 133, 123, 117, 111, 44, 125, 19, 236, 134, 51, 216, 206, 205, 154, 153, 22, 39, 37, 167, 200, 201, 208, 36, 142, 100, 57, 212, 202, 20, 60, 99, 28, 158, 157, 35, 226, 113, 160, 159, 27, 204, 202, 210, 113, 225, 46, 43, 202, 204, 62, 76, 77, 137, 123, 116, 41, 38, 72, 203, 129, 142, 64, 98, 240, 49, 102, 64, 41, 73, 74, 212, 216, 207, 42, 74, 184, 169, 170, 211, 170, 149, 176, 105, 66, 69, 122, 6, 168, 123, 147, 187, 96, 77, 90, 65, 55, 107, 89, 90, 180, 101, 100, 120, 63, 105, 104, 93, 137, 227, 15, 86, 85, 129, 102, 49, 14, 87, 86, 55, 8, 9, 100, 47, 121, 145, 23, 22, 88, 89, 179, 6, 122, 196, 88, 95, 96, 138, 172, 136, 215, 58, 172, 115, 48, 219, 42, 80, 81, 195, 3, 51, 43, 146, 61, 171, 175, 199, 81, 82, 38, 53, 46, 225, 144, 163, 110, 246, 33, 7, 52, 65, 66, 229, 228, 117, 34, 127, 234, 107, 108, 69, 109, 108, 151, 48, 64, 235, 62, 78, 191, 129, 209, 126, 111, 35, 143, 163, 161, 246, 117, 123, 50, 222, 65, 52, 19, 125, 141, 221, 55, 65, 3, 195, 197, 25, 7, 33, 220, 237, 44, 70, 71, 139, 122, 193, 245, 247, 130, 33, 71, 21, 162, 153, 158, 159, 170, 169, 150, 188, 174, 196, 216, 186, 92, 144, 160, 161, 2, 97, 167, 141, 125, 241, 164, 167, 37, 72, 38, 12, 145, 159, 160, 38, 82, 13, 63, 68, 71, 226, 35, 111, 158, 153, 154, 101, 50, 205, 206, 92, 165, 209, 198, 217, 165, 167, 97, 220, 115, 218, 133, 112, 243, 239, 238, 241, 214, 135, 169, 190, 173, 133, 171, 208, 32, 125, 44, 237, 86, 87, 178, 85, 86, 179, 84, 85, 180, 83, 84, 181, 201, 83, 182, 137, 93, 132, 76, 62, 183, 61, 76, 184, 57, 61, 185, 212, 57, 186, 214, 207, 187, 34, 143, 156, 79, 239, 237, 123, 137, 177, 44, 1, 4, 201, 194, 32, 64, 102, 129, 213, 215, 138, 59, 166, 219, 242, 99, 97, 2, 94, 141, 75, 59, 235, 24, 110, 228, 25, 130, 226, 23, 24, 229, 22, 23, 230, 26, 22, 231, 112, 26, 232, 189, 190, 243, 221, 56, 190, 28, 56, 221, 27, 28, 222, 29, 27, 223, 30, 29, 224, 247, 30, 225, 238, 79, 20, 166, 59, 75, 60, 75, 240, 147, 177, 215, 20, 79, 166, 187, 147, 213, 112, 233, 244, 233, 128, 245, 128, 114, 188, 114, 217, 174, 131, 115, 220, 217, 198, 236, 198, 131, 134, 177, 132, 58, 143, 35, 124, 110, 163, 7, 228, 110, 25, 356, 389, 368, 11, 302, 267, 452, 350, 349, 302, 303, 269, 357, 343, 277, 452, 453, 357, 333, 332, 297, 175, 152, 377, 384, 398, 382, 347, 348, 330, 303, 304, 270, 9, 336, 337, 278, 279, 360, 418, 262, 431, 304, 408, 409, 310, 415, 407, 270, 409, 410, 450, 348, 347, 422, 430, 434, 313, 314, 17, 306, 307, 375, 387, 388, 260, 286, 414, 398, 335, 406, 418, 364, 367, 416, 423, 358, 327, 251, 284, 298, 281, 5, 4, 373, 374, 253, 307, 320, 321, 425, 427, 411, 421, 313, 18, 321, 405, 406, 320, 404, 405, 315, 16, 17, 426, 425, 266, 377, 400, 369, 322, 391, 269, 417, 465, 464, 386, 257, 258, 466, 260, 388, 456, 399, 419, 284, 332, 333, 417, 285, 8, 346, 340, 261, 413, 441, 285, 327, 460, 328, 355, 371, 329, 392, 439, 438, 382, 341, 256, 429, 420, 360, 364, 394, 379, 277, 343, 437, 443, 444, 283, 275, 440, 363, 431, 262, 369, 297, 338, 337, 273, 375, 321, 450, 451, 349, 446, 342, 467, 293, 334, 282, 458, 461, 462, 276, 353, 383, 308, 324, 325, 276, 300, 293, 372, 345, 447, 382, 398, 362, 352, 345, 340, 274, 1, 19, 456, 248, 281, 436, 427, 425, 381, 256, 252, 269, 391, 393, 200, 199, 428, 266, 330, 329, 287, 273, 422, 250, 462, 328, 258, 286, 384, 265, 353, 342, 387, 259, 257, 424, 431, 430, 342, 353, 276, 273, 335, 424, 292, 325, 307, 366, 447, 345, 271, 303, 302, 423, 266, 371, 294, 455, 460, 279, 278, 294, 271, 272, 304, 432, 434, 427, 272, 407, 408, 394, 430, 431, 395, 369, 400, 334, 333, 299, 351, 417, 168, 352, 280, 411, 325, 319, 320, 295, 296, 336, 319, 403, 404, 330, 348, 349, 293, 298, 333, 323, 454, 447, 15, 16, 315, 358, 429, 279, 14, 15, 316, 285, 336, 9, 329, 349, 350, 374, 380, 252, 318, 402, 403, 6, 197, 419, 318, 319, 325, 367, 364, 365, 435, 367, 397, 344, 438, 439, 272, 271, 311, 195, 5, 281, 273, 287, 291, 396, 428, 199, 311, 271, 268, 283, 444, 445, 373, 254, 339, 263, 466, 249, 282, 334, 296, 449, 347, 346, 264, 447, 454, 336, 296, 299, 338, 10, 151, 278, 439, 455, 292, 407, 415, 358, 371, 355, 340, 345, 372, 390, 249, 466, 346, 347, 280, 442, 443, 282, 19, 94, 370, 441, 442, 295, 248, 419, 197, 263, 255, 359, 440, 275, 274, 300, 383, 368, 351, 412, 465, 263, 467, 466, 301, 368, 389, 380, 374, 386, 395, 378, 379, 412, 351, 419, 436, 426, 322, 373, 390, 388, 2, 164, 393, 370, 462, 461, 164, 0, 267, 302, 11, 12, 374, 373, 387, 268, 12, 13, 293, 300, 301, 446, 261, 340, 385, 384, 381, 330, 266, 425, 426, 423, 391, 429, 355, 437, 391, 327, 326, 440, 457, 438, 341, 382, 362, 459, 457, 461, 434, 430, 394, 414, 463, 362, 396, 369, 262, 354, 461, 457, 316, 403, 402, 315, 404, 403, 314, 405, 404, 313, 406, 405, 421, 418, 406, 366, 401, 361, 306, 408, 407, 291, 409, 408, 287, 410, 409, 432, 436, 410, 434, 416, 411, 264, 368, 383, 309, 438, 457, 352, 376, 401, 274, 275, 4, 421, 428, 262, 294, 327, 358, 433, 416, 367, 289, 455, 439, 462, 370, 326, 2, 326, 370, 305, 460, 455, 254, 449, 448, 255, 261, 446, 253, 450, 449, 252, 451, 450, 256, 452, 451, 341, 453, 452, 413, 464, 463, 441, 413, 414, 258, 442, 441, 257, 443, 442, 259, 444, 443, 260, 445, 444, 467, 342, 445, 459, 458, 250, 289, 392, 290, 290, 328, 460, 376, 433, 435, 250, 290, 392, 411, 416, 433, 341, 463, 464, 453, 464, 465, 357, 465, 412, 343, 412, 399, 360, 363, 440, 437, 399, 456, 420, 456, 363, 401, 435, 288, 372, 383, 353, 339, 255, 249, 448, 261, 255, 133, 243, 190, 133, 155, 112, 33, 246, 247, 33, 130, 25, 398, 384, 286, 362, 398, 414, 362, 463, 341, 263, 359, 467, 263, 249, 255, 466, 467, 260, 75, 60, 166, 238, 239, 79, 162, 127, 139, 72, 11, 37, 121, 232, 120, 73, 72, 39, 114, 128, 47, 233, 232, 128, 103, 104, 67, 152, 175, 148, 173, 157, 155, 119, 118, 101, 74, 73, 40, 107, 9, 108, 49, 48, 131, 32, 194, 211, 184, 74, 185, 191, 80, 183, 185, 40, 186, 119, 230, 118, 210, 202, 214, 84, 83, 17, 77, 76, 146, 161, 160, 30, 190, 56, 173, 182, 106, 194, 138, 135, 192, 129, 203, 98, 54, 21, 68, 5, 51, 4, 145, 144, 23, 90, 77, 91, 207, 205, 187, 83, 201, 18, 181, 91, 182, 180, 90, 181, 16, 85, 17, 205, 206, 36, 176, 148, 140, 165, 92, 39, 245, 193, 244, 27, 159, 28, 30, 247, 161, 174, 236, 196, 103, 54, 104, 55, 193, 8, 111, 117, 31, 221, 189, 55, 240, 98, 99, 142, 126, 100, 219, 166, 218, 112, 155, 26, 198, 209, 131, 169, 135, 150, 114, 47, 217, 224, 223, 53, 220, 45, 134, 32, 211, 140, 109, 67, 108, 146, 43, 91, 231, 230, 120, 113, 226, 247, 105, 63, 52, 241, 238, 242, 124, 46, 156, 95, 78, 96, 70, 46, 63, 116, 143, 227, 116, 123, 111, 1, 44, 19, 3, 236, 51, 207, 216, 205, 26, 154, 22, 165, 39, 167, 199, 200, 208, 101, 36, 100, 43, 57, 202, 242, 20, 99, 56, 28, 157, 124, 35, 113, 29, 160, 27, 211, 204, 210, 124, 113, 46, 106, 43, 204, 96, 62, 77, 227, 137, 116, 73, 41, 72, 36, 203, 142, 235, 64, 240, 48, 49, 64, 42, 41, 74, 214, 212, 207, 183, 42, 184, 210, 169, 211, 140, 170, 176, 104, 105, 69, 193, 122, 168, 50, 123, 187, 89, 96, 90, 66, 65, 107, 179, 89, 180, 119, 101, 120, 68, 63, 104, 234, 93, 227, 16, 15, 85, 209, 129, 49, 15, 14, 86, 107, 55, 9, 120, 100, 121, 153, 145, 22, 178, 88, 179, 197, 6, 196, 89, 88, 96, 135, 138, 136, 138, 215, 172, 218, 115, 219, 41, 42, 81, 5, 195, 51, 57, 43, 61, 208, 171, 199, 41, 81, 38, 224, 53, 225, 24, 144, 110, 105, 52, 66, 118, 229, 117, 227, 34, 234, 66, 107, 69, 10, 109, 151, 219, 48, 235, 183, 62, 191, 142, 129, 126, 116, 111, 143, 7, 163, 246, 118, 117, 50, 223, 222, 52, 94, 19, 141, 222, 221, 65, 196, 3, 197, 45, 220, 44, 156, 70, 139, 188, 122, 245, 139, 71, 162, 145, 153, 159, 149, 170, 150, 122, 188, 196, 206, 216, 92, 163, 144, 161, 164, 2, 167, 242, 141, 241, 0, 164, 37, 11, 72, 12, 144, 145, 160, 12, 38, 13, 70, 63, 71, 31, 226, 111, 157, 158, 154, 36, 101, 205, 203, 206, 165, 126, 209, 217, 98, 165, 97, 237, 220, 218, 237, 239, 241, 210, 214, 169, 140, 171, 32, 241, 125, 237, 179, 86, 178, 180, 85, 179, 181, 84, 180, 182, 83, 181, 194, 201, 182, 177, 137, 132, 184, 76, 183, 185, 61, 184, 186, 57, 185, 216, 212, 186, 192, 214, 187, 139, 34, 156, 218, 79, 237, 147, 123, 177, 45, 44, 4, 208, 201, 32, 98, 64, 129, 192, 213, 138, 235, 59, 219, 141, 242, 97, 97, 2, 141, 240, 75, 235, 229, 24, 228, 31, 25, 226, 230, 23, 229, 231, 22, 230, 232, 26, 231, 233, 112, 232, 244, 189, 243, 189, 221, 190, 222, 28, 221, 223, 27, 222, 224, 29, 223, 225, 30, 224, 113, 247, 225, 99, 60, 240, 213, 147, 215, 60, 20, 166, 192, 187, 213, 243, 112, 244, 244, 233, 245, 245, 128, 188, 188, 114, 174, 134, 131, 220, 174, 217, 236, 236, 198, 134, 215, 177, 58, 156, 143, 124, 25, 110, 7, 31, 228, 25, 264, 356, 368, 0, 11, 267, 451, 452, 349, 267, 302, 269, 350, 357, 277, 350, 452, 357, 299, 333, 297, 396, 175, 377, 381, 384, 382, 280, 347, 330, 269, 303, 270, 151, 9, 337, 344, 278, 360, 424, 418, 431, 270, 304, 409, 272, 310, 407, 322, 270, 410, 449, 450, 347, 432, 422, 434, 18, 313, 17, 291, 306, 375, 259, 387, 260, 424, 335, 418, 434, 364, 416, 391, 423, 327, 301, 251, 298, 275, 281, 4, 254, 373, 253, 375, 307, 321, 280, 425, 411, 200, 421, 18, 335, 321, 406, 321, 320, 405, 314, 315, 17, 423, 426, 266, 396, 377, 369, 270, 322, 269, 413, 417, 464, 385, 386, 258, 248, 456, 419, 298, 284, 333, 168, 417, 8, 448, 346, 261, 417, 413, 285, 326, 327, 328, 277, 355, 329, 309, 392, 438, 381, 382, 256, 279, 429, 360, 365, 364, 379, 355, 277, 437, 282, 443, 283, 281, 275, 363, 395, 431, 369, 299, 297, 337, 335, 273, 321, 348, 450, 349, 359, 446, 467, 283, 293, 282, 250, 458, 462, 300, 276, 383, 292, 308, 325, 283, 276, 293, 264, 372, 447, 346, 352, 340, 354, 274, 19, 363, 456, 281, 426, 436, 425, 380, 381, 252, 267, 269, 393, 421, 200, 428, 371, 266, 329, 432, 287, 422, 290, 250, 328, 385, 258, 384, 446, 265, 342, 386, 387, 257, 422, 424, 430, 445, 342, 276, 422, 273, 424, 306, 292, 307, 352, 366, 345, 268, 271, 302, 358, 423, 371, 327, 294, 460, 331, 279, 294, 303, 271, 304, 436, 432, 427, 304, 272, 408, 395, 394, 431, 378, 395, 400, 296, 334, 299, 6, 351, 168, 376, 352, 411, 307, 325, 320, 285, 295, 336, 320, 319, 404, 329, 330, 349, 334, 293, 333, 366, 323, 447, 316, 15, 315, 331, 358, 279, 317, 14, 316, 8, 285, 9, 277, 329, 350, 253, 374, 252, 319, 318, 403, 351, 6, 419, 324, 318, 325, 397, 367, 365, 288, 435, 397, 278, 344, 439, 310, 272, 311, 248, 195, 281, 375, 273, 291, 175, 396, 199, 312, 311, 268, 276, 283, 445, 390, 373, 339, 295, 282, 296, 448, 449, 346, 356, 264, 454, 337, 336, 299, 337, 338, 151, 294, 278, 455, 308, 292, 415, 429, 358, 355, 265, 340, 372, 388, 390, 466, 352, 346, 280, 295, 442, 282, 354, 19, 370, 285, 441, 295, 195, 248, 197, 457, 440, 274, 301, 300, 368, 417, 351, 465, 251, 301, 389, 385, 380, 386, 394, 395, 379, 399, 412, 419, 410, 436, 322, 387, 373, 388, 326, 2, 393, 354, 370, 461, 393, 164, 267, 268, 302, 12, 386, 374, 387, 312, 268, 13, 298, 293, 301, 265, 446, 340, 380, 385, 381, 280, 330, 425, 322, 426, 391, 420, 429, 437, 393, 391, 326, 344, 440, 438, 458, 459, 461, 364, 434, 394, 428, 396, 262, 274, 354, 457, 317, 316, 402, 316, 315, 403, 315, 314, 404, 314, 313, 405, 313, 421, 406, 323, 366, 361, 292, 306, 407, 306, 291, 408, 291, 287, 409, 287, 432, 410, 427, 434, 411, 372, 264, 383, 459, 309, 457, 366, 352, 401, 1, 274, 4, 418, 421, 262, 331, 294, 358, 435, 433, 367, 392, 289, 439, 328, 462, 326, 94, 2, 370, 289, 305, 455, 339, 254, 448, 359, 255, 446, 254, 253, 449, 253, 252, 450, 252, 256, 451, 256, 341, 452, 414, 413, 463, 286, 441, 414, 286, 258, 441, 258, 257, 442, 257, 259, 443, 259, 260, 444, 260, 467, 445, 309, 459, 250, 305, 289, 290, 305, 290, 460, 401, 376, 435, 309, 250, 392, 376, 411, 433, 453, 341, 464, 357, 453, 465, 343, 357, 412, 437, 343, 399, 344, 360, 440, 420, 437, 456, 360, 420, 363, 361, 401, 288, 265, 372, 353, 390, 339, 249, 339, 448, 255];
class nd {
    constructor(e) {
        N(this, "recognition", null);
        this.onRecognizedLetters = e
    }
    showTranscript(e) {
        const n = document.getElementById("speech-transcript");
        n && (n.innerText = e)
    }
    start() {
        const e = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!e) {
            console.warn("Web Speech API not supported in this browser.");
            return
        }
        this.recognition = new e, this.recognition.lang = "en-US", this.recognition.continuous = !0, this.recognition.interimResults = !1, this.recognition.onresult = n => {
            for (let s = n.resultIndex; s < n.results.length; ++s)
                if (n.results[s].isFinal) {
                    const r = n.results[s][0].transcript.trim();
                    console.log("Speech transcript:", r), this.showTranscript(r);
                    const i = Array.from(new Set(r.toUpperCase().replace(/[^A-Z]/g, "").split(""))).sort();
                    this.onRecognizedLetters(i)
                }
        }, this.recognition.onerror = n => {
            console.error("Speech recognition error:", n.error), this.showTranscript("No speech detected")
        }, this.recognition.onend = () => {
            var n;
            (n = this.recognition) == null || n.start()
        }, this.recognition.start()
    }
    stop() {
        var e;
        (e = this.recognition) == null || e.stop()
    }
}

function sd(t) {
    return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t
}
var Dr = {
    exports: {}
},
    rd = Dr.exports,
    Mu;

function id() {
    return Mu || (Mu = 1, function (t, e) {
        (function (n, s) {
            t.exports = s()
        })(rd, function () {
            var n = function () {
                function s(H) {
                    return o.appendChild(H.dom), H
                }

                function r(H) {
                    for (var V = 0; V < o.children.length; V++) o.children[V].style.display = V === H ? "block" : "none";
                    i = H
                }
                var i = 0,
                    o = document.createElement("div");
                o.style.cssText = "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000", o.addEventListener("click", function (H) {
                    H.preventDefault(), r(++i % o.children.length)
                }, !1);
                var c = (performance || Date).now(),
                    f = c,
                    _ = 0,
                    M = s(new n.Panel("FPS", "#0ff", "#002")),
                    A = s(new n.Panel("MS", "#0f0", "#020"));
                if (self.performance && self.performance.memory) var I = s(new n.Panel("MB", "#f08", "#201"));
                return r(0), {
                    REVISION: 16,
                    dom: o,
                    addPanel: s,
                    showPanel: r,
                    begin: function () {
                        c = (performance || Date).now()
                    },
                    end: function () {
                        _++;
                        var H = (performance || Date).now();
                        if (A.update(H - c, 200), H > f + 1e3 && (M.update(1e3 * _ / (H - f), 100), f = H, _ = 0, I)) {
                            var V = performance.memory;
                            I.update(V.usedJSHeapSize / 1048576, V.jsHeapSizeLimit / 1048576)
                        }
                        return H
                    },
                    update: function () {
                        c = this.end()
                    },
                    domElement: o,
                    setMode: r
                }
            };
            return n.Panel = function (s, r, i) {
                var o = 1 / 0,
                    c = 0,
                    f = Math.round,
                    _ = f(window.devicePixelRatio || 1),
                    M = 80 * _,
                    A = 48 * _,
                    I = 3 * _,
                    H = 2 * _,
                    V = 3 * _,
                    G = 15 * _,
                    j = 74 * _,
                    T = 30 * _,
                    Y = document.createElement("canvas");
                Y.width = M, Y.height = A, Y.style.cssText = "width:80px;height:48px";
                var B = Y.getContext("2d");
                return B.font = "bold " + 9 * _ + "px Helvetica,Arial,sans-serif", B.textBaseline = "top", B.fillStyle = i, B.fillRect(0, 0, M, A), B.fillStyle = r, B.fillText(s, I, H), B.fillRect(V, G, j, T), B.fillStyle = i, B.globalAlpha = .9, B.fillRect(V, G, j, T), {
                    dom: Y,
                    update: function (F, D) {
                        o = Math.min(o, F), c = Math.max(c, F), B.fillStyle = i, B.globalAlpha = 1, B.fillRect(0, 0, M, G), B.fillStyle = r, B.fillText(f(F) + " " + s + " (" + f(o) + "-" + f(c) + ")", I, H), B.drawImage(Y, V + _, G, j - _, T, V, G, j - _, T), B.fillRect(V + j - _, G, _, T), B.fillStyle = i, B.globalAlpha = .9, B.fillRect(V + j - _, G, _, f((1 - F / D) * T))
                    }
                }
            }, n
        })
    }(Dr)), Dr.exports
}
var od = id();
const ad = sd(od),
    cd = "/Content/WebGPU/card.glb",
    ud = 12,
    gn = 2e3,
    bn = class bn {
        constructor(e) {
            N(this, "canvas");
            N(this, "device");
            N(this, "context");
            N(this, "pipeline");
            N(this, "presentationFormat");
            N(this, "uniformBindGroup");
            N(this, "renderPassDescriptor");
            N(this, "cubeTexture");
            N(this, "cameras");
            N(this, "aspect");
            N(this, "params", {
                enableCam: !1,
                type: "arcball",
                model: "monkey",
                uTestValue: 1,
                uTestValue_02: 1,
                uNoiseScale: 2,
                uAirResistance: .85,
                uBoundaryRadius: 4,
                uGlow_Threshold: .5,
                uGlow_ThresholdKnee: .1,
                uGlow_Radius: 3,
                uGlow_Intensity: .5
            });
            N(this, "uTime", 0);
            N(this, "gui");
            N(this, "lastFrameMS");
            N(this, "demoVerticesBuffer");
            N(this, "loadVerticesBuffer");
            N(this, "loadIndexBuffer");
            N(this, "loadIndexCount");
            N(this, "particleVerticesBuffer");
            N(this, "particleIndexBuffer");
            N(this, "particleIndexCount");
            N(this, "particleVertexLayout");
            N(this, "uniformBuffer");
            N(this, "viewMatrixBuffer");
            N(this, "projectionMatrixBuffer");
            N(this, "canvasSizeBuffer");
            N(this, "uTimeBuffer");
            N(this, "modelMatrixBuffer");
            N(this, "uTestValueBuffer");
            N(this, "uTestValue_02Buffer");
            N(this, "uNoiseScaleBuffer");
            N(this, "uAirResistanceBuffer");
            N(this, "uBoundaryRadiusBuffer");
            N(this, "loadVertexLayout");
            N(this, "modelMatrix");
            N(this, "particle_modelMatrix");
            N(this, "viewMatrix");
            N(this, "projectionMatrix");
            N(this, "depthTexture");
            N(this, "sampler");
            N(this, "newCameraType");
            N(this, "oldCameraType");
            N(this, "renderTarget_ping");
            N(this, "renderTarget_pong");
            N(this, "postProcessEffects", []);
            N(this, "inputHandler");
            N(this, "passThroughEffect");
            N(this, "brightPassEffect");
            N(this, "blurEffectH");
            N(this, "blurEffectV");
            N(this, "glowAddEffect");
            N(this, "unrealGlowEffect");
            N(this, "enableGlow", !0);
            N(this, "particleRenderer");
            N(this, "particleBufferA");
            N(this, "usePing", !0);
            N(this, "particleComputePipeline");
            N(this, "deltaTimeBuffer");
            N(this, "prevDt", 1 / 60);
            N(this, "initialParticlePositions");
            N(this, "initialParticleNormals");
            N(this, "meshSamplesArray");
            N(this, "webcam", document.getElementById("webcam"));
            N(this, "faceLandmarker");
            N(this, "faceLandmarkerLoaded", !1);
            N(this, "landmarkCanvas", document.getElementById("landmark-canvas"));
            N(this, "landmarkCtx", this.landmarkCanvas.getContext("2d"));
            N(this, "speechService");
            N(this, "uLetterIDBuffer");
            N(this, "stats");
            N(this, "lastVideoTime", -1);
            N(this, "webcamRunning", !1);
            this.canvas = e, this.gui = new Sf, this.cameras = {
                arcball: new Rf({
                    position: bn.CAMERA_POSITION
                }),
                WASD: new Mf({
                    position: bn.CAMERA_POSITION
                })
            }, this.oldCameraType = this.params.type, this.lastFrameMS = Date.now(), this.sampler = {}, this.inputHandler = Lf(window, this.canvas), this.modelMatrix = Pt.identity(), this.particle_modelMatrix = Pt.identity(), this.viewMatrix = Pt.identity(), this.projectionMatrix = Pt.identity(), this.webcam.addEventListener("loadeddata", () => {
                this.landmarkCanvas.width = this.webcam.videoWidth, this.landmarkCanvas.height = this.webcam.videoHeight
            }), this.setupAndRender(), this.speechService = new nd(this.onRecognizedLetters.bind(this)), this.speechService.start(), this.stats = new ad, this.stats.showPanel(0), document.body.appendChild(this.stats.dom)
        }
        async setupAndRender() {
            await this.initializeWebGPU(), this.initRenderTargetsForPP(), await this.initLoadAndProcessGLB(), this.initUniformBuffer(), await this.loadTexture(), this.initParticleSystem(), this.initCam(), this.initPipelineBindGrp(), this.initializeGUI(), this.setupEventListeners(), this.renderFrame()
        }
        async predictWebcam() {
            if (!this.faceLandmarkerLoaded || !this.webcam || this.webcam.readyState !== 4) {
                requestAnimationFrame(this.predictWebcam.bind(this));
                return
            }
            if (this.lastVideoTime !== this.webcam.currentTime) {
                this.lastVideoTime = this.webcam.currentTime;
                const e = performance.now(),
                    n = await this.faceLandmarker.detectForVideo(this.webcam, e);
                if (n.faceLandmarks && n.faceLandmarks.length > 0) {
                    const s = this.landmarkCtx;
                    s.clearRect(0, 0, this.landmarkCanvas.width, this.landmarkCanvas.height), s.fillStyle = "red";
                    for (const A of n.faceLandmarks[0]) {
                        const I = A.x * this.landmarkCanvas.width,
                            H = A.y * this.landmarkCanvas.height;
                        s.beginPath(), s.arc(I, H, 2, 0, 2 * Math.PI), s.fill()
                    }
                    const r = n.faceLandmarks[0],
                        i = 6,
                        o = r.length,
                        c = new Float32Array(o * i);
                    for (let A = 0; A < o; A++) {
                        const I = r[A];
                        c[A * i + 0] = I.x * 2 - 1, c[A * i + 1] = -(I.y * 2 - 1), c[A * i + 2] = I.z ?? 0, c[A * i + 3] = 0, c[A * i + 4] = 0, c[A * i + 5] = 1
                    }
                    const f = new Uint16Array(td),
                        _ = this.sampleMeshSurfacePoints(c, f, i, 0, 3, gn),
                        M = new Float32Array(gn * 4);
                    for (let A = 0; A < gn; A++) M.set(_[A].position, A * 4), M[A * 4 + 3] = 1;
                    this.particleBufferA.setMeshSamples(M)
                } else this.landmarkCtx.clearRect(0, 0, this.landmarkCanvas.width, this.landmarkCanvas.height)
            }
            this.webcamRunning && requestAnimationFrame(this.predictWebcam.bind(this))
        }
        enableCam() {
            navigator.mediaDevices.getUserMedia({
                video: !0
            }).then(e => {
                this.webcam.srcObject = e, this.webcam.addEventListener("loadeddata", async () => {
                    await this.loadFaceLandmarker(), this.webcamRunning = !0, this.predictWebcam()
                }, {
                    once: !0
                })
            })
        }
        async loadFaceLandmarker() {
            const e = await Kn.forVisionTasks("/Content/WebGPU");
            console.log(['e, Kn, Kn.forVisionTasks', e, Kn, Kn.forVisionTasks]);
            this.faceLandmarker = await je.createFromOptions(e, {
                baseOptions: {
                    modelAssetPath: "/Content/WebGPU/face_landmarker.wasm"
                },
                runningMode: "VIDEO",
                numFaces: 1
            }), this.faceLandmarkerLoaded = !0
        }
        onRecognizedLetters(e) {
            console.log("Recognized letters:", e);
            const n = 32,
                s = new Uint32Array(n);
            if (e.length > 0) {
                const r = e.map(i => i.toUpperCase().charCodeAt(0) - 65);
                for (let i = 0; i < n; i++) {
                    const o = Math.floor(i * e.length / n);
                    s[i] = r[o]
                }
            } else s.fill(0);
            this.device.queue.writeBuffer(this.uLetterIDBuffer, 0, s.buffer)
        }
        initParticleSystem() {
            this.particleBufferA = new Sh(this.device, gn, this.initialParticlePositions, void 0, void 0), this.particleBufferA.setMeshSamples(this.meshSamplesArray), this.particleRenderer = new Mh(this.device, this.presentationFormat, this.particleVerticesBuffer, this.particleIndexBuffer, this.particleIndexCount, this.particleVertexLayout, this.cubeTexture, this.sampler);
            const e = this.device.createBindGroupLayout({
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "storage"
                    }
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "storage"
                    }
                }, {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                }, {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                }, {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "storage"
                    }
                }, {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 6,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 7,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 8,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 9,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 10,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "storage"
                    }
                }, {
                    binding: 11,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }]
            });
            this.particleComputePipeline = this.device.createComputePipeline({
                layout: this.device.createPipelineLayout({
                    bindGroupLayouts: [e]
                }),
                compute: {
                    module: this.device.createShaderModule({
                        code: Rh
                    }),
                    entryPoint: "main"
                }
            }), this.deltaTimeBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            })
        }
        sampleMeshSurfacePoints(e, n, s, r, i, o) {
            const c = [],
                f = n.length / 3;
            for (let _ = 0; _ < o; _++) {
                const M = Math.floor(Math.random() * f),
                    A = n[M * 3 + 0],
                    I = n[M * 3 + 1],
                    H = n[M * 3 + 2],
                    V = e.subarray(A * s + r, A * s + r + 3),
                    G = e.subarray(I * s + r, I * s + r + 3),
                    j = e.subarray(H * s + r, H * s + r + 3),
                    T = e.subarray(A * s + i, A * s + i + 3),
                    Y = e.subarray(I * s + i, I * s + i + 3),
                    B = e.subarray(H * s + i, H * s + i + 3);
                let F = Math.random(),
                    D = Math.random();
                F + D > 1 && (F = 1 - F, D = 1 - D);
                const K = 1 - F - D,
                    P = [F * V[0] + D * G[0] + K * j[0], F * V[1] + D * G[1] + K * j[1], F * V[2] + D * G[2] + K * j[2]],
                    U = [F * T[0] + D * Y[0] + K * B[0], F * T[1] + D * Y[1] + K * B[1], F * T[2] + D * Y[2] + K * B[2]],
                    X = Math.hypot(U[0], U[1], U[2]),
                    $ = [U[0] / X, U[1] / X, U[2] / X];
                c.push({
                    position: new Float32Array(P),
                    normal: new Float32Array($)
                })
            }
            return c
        }
        sampleFaceLandmarkPoints(e, n, s = .01) {
            const r = [],
                i = e.length;
            for (let o = 0; o < n; o++) {
                const c = Math.floor(Math.random() * i),
                    f = Math.floor(Math.random() * i),
                    _ = Math.floor(Math.random() * i);
                let M = Math.random(),
                    A = Math.random();
                M + A > 1 && (M = 1 - M, A = 1 - A);
                const I = 1 - M - A,
                    H = e[c],
                    V = e[f],
                    G = e[_];
                let j = M * H.x + A * V.x + I * G.x,
                    T = M * H.y + A * V.y + I * G.y,
                    Y = H.z !== void 0 && V.z !== void 0 && G.z !== void 0 ? M * H.z + A * V.z + I * G.z : 0;
                j += (Math.random() - .5) * s, T += (Math.random() - .5) * s, Y += (Math.random() - .5) * s, r.push({
                    x: j,
                    y: T,
                    z: Y
                })
            }
            return r
        }
        async initLoadAndProcessGLB() {
            const e = bn.MODEL_PATHS[this.params.model],
                {
                    interleavedData: n,
                    indices: s,
                    indexCount: r,
                    vertexLayout: i
                } = await fc(e),
                o = this.device.createBuffer({
                    size: n.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: !1
                });
            this.device.queue.writeBuffer(o, 0, n);
            let c;
            if (s) {
                const j = Math.ceil(s.byteLength / 4) * 4;
                c = this.device.createBuffer({
                    size: j,
                    usage: GPUBufferUsage.INDEX,
                    mappedAtCreation: !0
                }), new Uint16Array(c.getMappedRange()).set(s), c.unmap()
            }
            this.loadVerticesBuffer = o, this.loadIndexBuffer = c, this.loadIndexCount = r, this.loadVertexLayout = i, console.log("Curl Surface Mesh :", this.loadVertexLayout);
            const M = this.sampleMeshSurfacePoints(n, s, ud, 0, 3, gn);
            this.meshSamplesArray = new Float32Array(gn * 4);
            for (let j = 0; j < gn; j++) this.meshSamplesArray.set(M[j].position, j * 4), this.meshSamplesArray[j * 4 + 3] = 1;
            this.initialParticlePositions = new Float32Array(gn * 4), this.initialParticleNormals = new Float32Array(gn * 4);
            for (let j = 0; j < gn; j++) {
                const T = M[j];
                this.initialParticlePositions.set(T.position, j * 4), this.initialParticlePositions[j * 4 + 3] = 1
            }
            const {
                interleavedData: A,
                indices: I,
                indexCount: H,
                vertexLayout: V
            } = await fc(cd);
            console.log("Particle Inatancing Mesh :", V), this.particleVerticesBuffer = this.device.createBuffer({
                size: A.byteLength,
                usage: GPUBufferUsage.VERTEX,
                mappedAtCreation: !0
            }), new Float32Array(this.particleVerticesBuffer.getMappedRange()).set(A), this.particleVerticesBuffer.unmap();
            let G;
            if (I) {
                const j = Math.ceil(I.byteLength / 4) * 4;
                G = this.device.createBuffer({
                    size: j,
                    usage: GPUBufferUsage.INDEX,
                    mappedAtCreation: !0
                }), new Uint16Array(G.getMappedRange()).set(I), G.unmap()
            }
            this.particleIndexBuffer = G, this.particleIndexCount = H, this.particleVertexLayout = V
        }
        initCam() {
            this.aspect = this.canvas.width / this.canvas.height, this.projectionMatrix = Pt.perspective(2 * Math.PI / 5, this.aspect, .01, 1e3);
            const e = window.devicePixelRatio;
            this.canvas.width = this.canvas.clientWidth * e, this.canvas.height = this.canvas.clientHeight * e, this.device.queue.writeBuffer(this.projectionMatrixBuffer, 0, this.projectionMatrix.buffer)
        }
        async loadTexture() {
            const e = await fetch("/Content/WebGPU/AtoZ.png"),
                n = await createImageBitmap(await e.blob());
            this.cubeTexture = this.device.createTexture({
                size: [n.width, n.height, 1],
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
            }), this.device.queue.copyExternalImageToTexture({
                source: n
            }, {
                texture: this.cubeTexture
            }, [n.width, n.height])
        }
        initUniformBuffer() {
            this.viewMatrixBuffer = this.device.createBuffer({
                size: 16 * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            }), this.device.queue.writeBuffer(this.viewMatrixBuffer, 0, this.viewMatrix.buffer), this.projectionMatrixBuffer = this.device.createBuffer({
                size: 16 * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            }), this.device.queue.writeBuffer(this.projectionMatrixBuffer, 0, this.projectionMatrix.buffer), this.canvasSizeBuffer = this.device.createBuffer({
                size: 2 * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const e = new Float32Array([this.canvas.width, this.canvas.height]);
            this.device.queue.writeBuffer(this.canvasSizeBuffer, 0, e.buffer), this.uTimeBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const n = new Float32Array([this.uTime]);
            this.device.queue.writeBuffer(this.uTimeBuffer, 0, n.buffer), this.modelMatrixBuffer = this.device.createBuffer({
                size: 16 * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            }), this.device.queue.writeBuffer(this.modelMatrixBuffer, 0, this.modelMatrix.buffer), this.uTestValueBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const s = new Float32Array([this.params.uTestValue]);
            this.device.queue.writeBuffer(this.uTestValueBuffer, 0, s.buffer), this.uTestValue_02Buffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const r = new Float32Array([this.params.uTestValue_02]);
            this.device.queue.writeBuffer(this.uTestValue_02Buffer, 0, r.buffer), this.uNoiseScaleBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const i = new Float32Array([this.params.uNoiseScale]);
            this.device.queue.writeBuffer(this.uNoiseScaleBuffer, 0, i.buffer), this.uAirResistanceBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const o = new Float32Array([this.params.uAirResistance]);
            this.device.queue.writeBuffer(this.uAirResistanceBuffer, 0, o.buffer), this.uBoundaryRadiusBuffer = this.device.createBuffer({
                size: 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            const c = new Float32Array([this.params.uBoundaryRadius]);
            this.device.queue.writeBuffer(this.uBoundaryRadiusBuffer, 0, c.buffer), this.uLetterIDBuffer = this.device.createBuffer({
                size: 128,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            }), this.device.queue.writeBuffer(this.uLetterIDBuffer, 0, new Uint8Array(128))
        }
        setupEventListeners() {
            window.addEventListener("resize", this.resize.bind(this))
        }
        resize() {
            const e = window.devicePixelRatio;
            this.canvas.width = this.canvas.clientWidth * e, this.canvas.height = this.canvas.clientHeight * e, this.aspect = this.canvas.width / this.canvas.height, this.projectionMatrix = Pt.perspective(2 * Math.PI / 5, this.aspect, 1, 100), this.context.configure({
                device: this.device,
                format: navigator.gpu.getPreferredCanvasFormat()
            }), this.device.queue.writeBuffer(this.projectionMatrixBuffer, 0, this.projectionMatrix.buffer);
            const n = new Float32Array([this.canvas.width, this.canvas.height]);
            this.device.queue.writeBuffer(this.canvasSizeBuffer, 0, n.buffer), this.depthTexture = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            }), this.renderTarget_ping.resize(this.device, this.canvas.width, this.canvas.height, this.presentationFormat), this.renderTarget_pong.resize(this.device, this.canvas.width, this.canvas.height, this.presentationFormat)
        }
        initializeGUI() {
            this.gui.add(this.params, "enableCam").name("Enable Camera").onChange(s => {
                var r;
                s ? this.enableCam() : (this.webcam.srcObject && (this.webcam.srcObject.getTracks().forEach(i => i.stop()), this.webcam.srcObject = null), this.webcamRunning = !1, (r = this.landmarkCtx) == null || r.clearRect(0, 0, this.landmarkCanvas.width, this.landmarkCanvas.height))
            }), this.gui.add(this.params, "model", ["monkey", "teapot", "cylinder"]).onChange(async () => {
                await this.initLoadAndProcessGLB(), this.initParticleSystem()
            });
            const e = this.gui.addFolder("Particle Params");
            e.add(this.params, "uNoiseScale", 0, 5).step(.01).onChange(s => {
                this.updateFloatUniform("uNoiseScale", s)
            }), e.add(this.params, "uAirResistance", 0, 1).step(.01).onChange(s => {
                this.updateFloatUniform("uAirResistance", s)
            }), e.add(this.params, "uBoundaryRadius", .5, 10).step(.01).onChange(s => {
                this.updateFloatUniform("uBoundaryRadius", s)
            }), e.open();
            const n = this.gui.addFolder("Glow FX");
            n.add(this.params, "uGlow_Threshold", 0, 1).step(.01).onChange(() => this.updateGlowUniforms()), n.add(this.params, "uGlow_ThresholdKnee", 0, 1).step(.01).onChange(() => this.updateGlowUniforms()), n.add(this.params, "uGlow_Radius", .1, 20).step(.1).onChange(() => this.updateGlowUniforms()), n.add(this.params, "uGlow_Intensity", 0, 1).step(.001).onChange(() => this.updateGlowUniforms())
        }
        updateGlowUniforms() {
            this.brightPassEffect.setThreshold(this.params.uGlow_Threshold), this.brightPassEffect.setKnee(this.params.uGlow_ThresholdKnee), this.blurEffectH.setRadius(this.params.uGlow_Radius), this.blurEffectV.setRadius(this.params.uGlow_Radius), this.glowAddEffect.setIntensity(this.params.uGlow_Intensity)
        }
        updateFloatUniform(e, n) {
            const s = new Float32Array([n]);
            switch (e) {
                case "uTestValue":
                    this.device.queue.writeBuffer(this.uTestValueBuffer, 0, s.buffer);
                    break;
                case "uTestValue_02":
                    this.device.queue.writeBuffer(this.uTestValue_02Buffer, 0, s.buffer);
                    break;
                case "uNoiseScale":
                    this.device.queue.writeBuffer(this.uNoiseScaleBuffer, 0, s.buffer);
                    break;
                case "uAirResistance":
                    this.device.queue.writeBuffer(this.uAirResistanceBuffer, 0, s.buffer);
                    break;
                case "uBoundaryRadius":
                    this.device.queue.writeBuffer(this.uBoundaryRadiusBuffer, 0, s.buffer);
                    break;
                default:
                    console.error(`Unknown key: ${e}`);
                    return
            }
        }
        async initializeWebGPU() {
            var s;
            const e = await ((s = navigator.gpu) == null ? void 0 : s.requestAdapter({
                featureLevel: "compatibility"
            }));
            this.device = await (e == null ? void 0 : e.requestDevice({
                requiredLimits: {
                    maxStorageBuffersPerShaderStage: 10
                }
            })), this.context = this.canvas.getContext("webgpu");
            const n = window.devicePixelRatio;
            this.canvas.width = this.canvas.clientWidth * n, this.canvas.height = this.canvas.clientHeight * n, this.presentationFormat = navigator.gpu.getPreferredCanvasFormat(), this.context.configure({
                device: this.device,
                format: this.presentationFormat
            }), this.sampler = this.device.createSampler({
                magFilter: "linear",
                minFilter: "linear",
                mipmapFilter: "linear"
            }), this.depthTexture = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                format: "depth24plus",
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            }), this.renderPassDescriptor = {
                colorAttachments: [{
                    view: void 0,
                    clearValue: bn.CLEAR_COLOR,
                    loadOp: "clear",
                    storeOp: "store"
                }],
                depthStencilAttachment: {
                    view: this.depthTexture.createView(),
                    depthClearValue: 1,
                    depthLoadOp: "clear",
                    depthStoreOp: "store"
                }
            }
        }
        initPipelineBindGrp() {
            const e = this.device.createBindGroupLayout({
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 2,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 3,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 4,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 5,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 6,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }, {
                    binding: 7,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {
                        type: "filtering"
                    }
                }, {
                    binding: 8,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float"
                    }
                }]
            });
            this.pipeline = this.device.createRenderPipeline({
                layout: this.device.createPipelineLayout({
                    bindGroupLayouts: [e]
                }),
                vertex: {
                    module: this.device.createShaderModule({
                        code: tc
                    }),
                    entryPoint: "vertex_main",
                    buffers: [{
                        arrayStride: this.loadVertexLayout.arrayStride,
                        attributes: this.loadVertexLayout.attributes
                    }]
                },
                fragment: {
                    module: this.device.createShaderModule({
                        code: tc
                    }),
                    entryPoint: "fragment_main",
                    targets: [{
                        format: this.presentationFormat
                    }]
                },
                primitive: {
                    topology: "triangle-list",
                    cullMode: "none"
                },
                depthStencil: {
                    format: "depth24plus",
                    depthWriteEnabled: !0,
                    depthCompare: "less"
                }
            }), this.uniformBindGroup = this.device.createBindGroup({
                layout: e,
                entries: [{
                    binding: 0,
                    resource: {
                        buffer: this.viewMatrixBuffer
                    }
                }, {
                    binding: 1,
                    resource: {
                        buffer: this.projectionMatrixBuffer
                    }
                }, {
                    binding: 2,
                    resource: {
                        buffer: this.canvasSizeBuffer
                    }
                }, {
                    binding: 3,
                    resource: {
                        buffer: this.uTimeBuffer
                    }
                }, {
                    binding: 4,
                    resource: {
                        buffer: this.modelMatrixBuffer
                    }
                }, {
                    binding: 5,
                    resource: {
                        buffer: this.uTestValueBuffer
                    }
                }, {
                    binding: 6,
                    resource: {
                        buffer: this.uTestValue_02Buffer
                    }
                }, {
                    binding: 7,
                    resource: this.sampler
                }, {
                    binding: 8,
                    resource: this.cubeTexture.createView()
                }]
            })
        }
        getViewMatrix(e) {
            return this.cameras[this.params.type].update(e, this.inputHandler())
        }
        initRenderTargetsForPP() {
            this.renderTarget_ping = new Wr(this.device, this.canvas.width, this.canvas.height, this.presentationFormat), this.renderTarget_pong = new Wr(this.device, this.canvas.width, this.canvas.height, this.presentationFormat), this.passThroughEffect = new bh(this.device, this.presentationFormat, this.sampler), this.brightPassEffect = new Eh(this.device, this.presentationFormat, this.sampler, this.params.uGlow_Threshold, this.params.uGlow_ThresholdKnee), this.postProcessEffects.push(new xh(this.device, this.presentationFormat, this.sampler, [this.canvas.width, this.canvas.height])), this.blurEffectH = new gc(this.device, this.presentationFormat, this.sampler, [1, 0], [1 / this.canvas.width, 1 / this.canvas.height], this.params.uGlow_Radius), this.blurEffectV = new gc(this.device, this.presentationFormat, this.sampler, [0, 1], [1 / this.canvas.width, 1 / this.canvas.height], this.params.uGlow_Radius), this.glowAddEffect = new Ah(this.device, this.presentationFormat, this.sampler, this.params.uGlow_Intensity), this.unrealGlowEffect = new Th(this.device, this.presentationFormat, this.sampler, this.canvas.width, this.canvas.height, 4, this.brightPassEffect, this.blurEffectH, this.blurEffectV, this.glowAddEffect, this.passThroughEffect)
        }
        renderFrame() {
            this.stats.begin();
            const e = Date.now(),
                n = (e - this.lastFrameMS) / 1e3,
                s = 1 / 120,
                r = 1 / 30,
                i = Math.max(s, Math.min(r, n));
            let o = this.prevDt * .8 + i * .2;
            this.prevDt = o, this.lastFrameMS = e, this.uTime += this.prevDt;
            const c = new Float32Array([this.uTime]);
            this.device.queue.writeBuffer(this.uTimeBuffer, 0, c.buffer), this.viewMatrix = this.getViewMatrix(this.prevDt), this.device.queue.writeBuffer(this.viewMatrixBuffer, 0, this.viewMatrix.buffer), this.postProcessEffects.length === 0 ? this.renderPassDescriptor.colorAttachments[0].view = this.context.getCurrentTexture().createView() : this.renderPassDescriptor.colorAttachments[0].view = this.renderTarget_ping.view, this.renderPassDescriptor.depthStencilAttachment.view = this.depthTexture.createView();
            const f = this.device.createCommandEncoder();
            this.particleBufferA.updateParticles(this.device, f, this.particleComputePipeline, this.prevDt, this.deltaTimeBuffer, this.uTimeBuffer, this.uNoiseScaleBuffer, this.uAirResistanceBuffer, this.uBoundaryRadiusBuffer, this.uLetterIDBuffer);
            const _ = f.beginRenderPass(this.renderPassDescriptor);
            this.particleRenderer.updateUniforms(this.device, this.projectionMatrix, this.viewMatrix, this.particle_modelMatrix), this.particleRenderer.render(_, this.particleBufferA), _.end(), this.usePing = !this.usePing;
            let M = this.renderTarget_ping.view;
            if (this.postProcessEffects.length > 0) {
                let A = this.renderTarget_ping.view,
                    I = this.renderTarget_pong.view;
                for (let H = 0; H < this.postProcessEffects.length; H++) {
                    const V = H === this.postProcessEffects.length - 1;
                    this.enableGlow ? M = I : M = V ? this.context.getCurrentTexture().createView() : I, this.postProcessEffects[H].apply(f, {
                        A
                    }, M, [this.canvas.width, this.canvas.height]), V || ([A, I] = [I, A])
                }
                this.enableGlow && this.unrealGlowEffect.apply(f, M, this.context.getCurrentTexture().createView())
            }
            this.device.queue.submit([f.finish()]), this.stats.end(), requestAnimationFrame(this.renderFrame.bind(this))
        }
    };
N(bn, "CLEAR_COLOR", [.1, .1, .1, 1]), N(bn, "CAMERA_POSITION", ve.create(0, 0, 2)), N(bn, "MODEL_PATHS", {
    monkey: "/Content/WebGPU/monkey_color.glb",
    teapot: "/Content/WebGPU/teapot.glb",
    cylinder: "/Content/WebGPU/light_color.glb"
});
let So = bn;
new So(document.getElementById("app"));