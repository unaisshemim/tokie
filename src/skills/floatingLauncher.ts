const BTN_ID = "tokie-floating-launcher";

export function mountFloatingLauncher(onClick: () => void): () => void {
  if (document.getElementById(BTN_ID)) {
    return () => {};
  }

  const wrap = document.createElement("div");
  wrap.id = BTN_ID;
  wrap.style.cssText =
    "position:fixed;bottom:24px;right:24px;z-index:2147483646;cursor:pointer;font-size:0;display:block;";

  const img = document.createElement("img");
  img.src = browser.runtime.getURL(
    "icon/96.png" as Parameters<typeof browser.runtime.getURL>[0]
  );
  img.alt = "Open Tokie skills";
  img.width = 56;
  img.height = 56;
  img.draggable = false;
  img.style.display = "block";
  img.style.borderRadius = "12px";

  wrap.appendChild(img);
  wrap.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  document.documentElement.appendChild(wrap);

  return () => {
    wrap.remove();
  };
}
