// src/ui/FileUploader.js
export class FileUploader {
  constructor({ dropZone, fileInput, onFile }) {
    this.onFile = onFile;
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
    dropZone.addEventListener('dragleave', ()=> dropZone.classList.remove('over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) this.onFile(file);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) this.onFile(e.target.files[0]);
    });
  }
}