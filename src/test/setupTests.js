import '@testing-library/jest-dom';

if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
