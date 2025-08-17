const savedColorTheme = localStorage.getItem('faststream-color-theme');
if (savedColorTheme) {
  document.body.dataset.theme = savedColorTheme;
}
