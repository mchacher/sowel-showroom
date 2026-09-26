// Loaded by the proxy into every page of the Sowel interface (see nginx.conf), next
// to the "3D" button it injects. A file rather than inline code because the
// interface's CSP allows scripts from this origin and none inline.
//
// Inside the side-by-side page the 3D is already on screen, and the button would
// open a second demo inside the first pane. So there it goes.
if (window.top !== window.self) {
  document.getElementById("showroom-3d")?.remove();
}
