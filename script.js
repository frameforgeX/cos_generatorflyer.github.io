// COS26 Flyer Maker – draws the user's photo + name onto the template (canvas) and downloads a PNG.
(function () {
  // Template size and the two areas we replace (measured from template.jpg)
  var W = 1200, H = 1500;
  var WIN = { x: 124, y: 180, w: 953, h: 941 };   // green photo window
  var BOX = { x: 171, y: 1268, w: 355, h: 75 };   // green "Name Here" box
  var GREEN = "rgb(212, 23, 23)";

  var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  var nm = document.getElementById("nm"), ph = document.getElementById("ph"), zm = document.getElementById("zm");
  var dl = document.getElementById("dl"), msg = document.getElementById("msg");
  var tplImg = document.getElementById("tpl");
  var overlay = null, photo = null, st = { z: 1, ox: 0, oy: 0 };

  // Copy the template and make the green photo window transparent
  function buildOverlay() {
    overlay = document.createElement("canvas");
    overlay.width = W; overlay.height = H;
    var o = overlay.getContext("2d");
    o.drawImage(tplImg, 0, 0, W, H);
    var x0 = WIN.x - 3, y0 = WIN.y - 3, w = WIN.w + 6, h = WIN.h + 6;
    var d = o.getImageData(x0, y0, w, h), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      if (p[i + 1] > p[i] + 40 && p[i + 1] > p[i + 2] + 40) p[i + 3] = 0;
    }
    o.putImageData(d, x0, y0);
  }

  function baseScale() { return Math.max(WIN.w / photo.width, WIN.h / photo.height); }

  function clampOffset() {
    var s = baseScale() * st.z;
    var mx = Math.max(0, (photo.width * s - WIN.w) / 2);
    var my = Math.max(0, (photo.height * s - WIN.h) / 2);
    st.ox = Math.max(-mx, Math.min(mx, st.ox));
    st.oy = Math.max(-my, Math.min(my, st.oy));
  }

  function fitFont(text, font, maxW, start, min) {
    var size = start; ctx.font = "700 " + size + "px " + font;
    while (ctx.measureText(text).width > maxW && size > min) {
      size -= 2; ctx.font = "700 " + size + "px " + font;
    }
    return size;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#9d003c"; ctx.fillRect(0, 0, W, H);

    if (photo) {
      clampOffset();
      var s = baseScale() * st.z, dw = photo.width * s, dh = photo.height * s;
      ctx.save();
      ctx.beginPath(); ctx.rect(WIN.x - 3, WIN.y - 3, WIN.w + 6, WIN.h + 6); ctx.clip();
      ctx.drawImage(photo, WIN.x + WIN.w / 2 - dw / 2 + st.ox, WIN.y + WIN.h / 2 - dh / 2 + st.oy, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = "#f3e3d3"; ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      ctx.fillStyle = "#9d003c"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 48px Syne, sans-serif";
      ctx.fillText("Your photo here", WIN.x + WIN.w / 2, WIN.y + WIN.h / 2);
    }

    if (overlay) ctx.drawImage(overlay, 0, 0);

    // Name box: the green box grows for longer names, text shrinks if it is very long
    var name = nm.value.trim(), text = name || "Your Name", font = "Syne, sans-serif";
    var size = fitFont(text, font, 620, 42, 22), tw = ctx.measureText(text).width;
    var bw = Math.max(BOX.w, Math.min(680, tw + 60));
    ctx.fillStyle = GREEN; ctx.fillRect(BOX.x - 2, BOX.y - 2, bw + 4, BOX.h + 4);
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "700 " + size + "px " + font;
    ctx.fillText(text, BOX.x + bw / 2, BOX.y + BOX.h / 2 + 2);

    dl.disabled = !(photo && name);
    msg.textContent = !photo && !name ? "Add your name and photo to get started."
      : !name ? "Now type your name."
      : !photo ? "Now choose a photo."
      : "Looks good? Download your flyer.";
  }

  function start() {
    buildOverlay();
    var fontReady = document.fonts && document.fonts.load ? document.fonts.load("700 42px Syne") : Promise.resolve();
    fontReady.catch(function () {}).then(draw);
  }
  if (tplImg.complete && tplImg.naturalWidth) start(); else tplImg.onload = start;
  draw();

  nm.addEventListener("input", draw);

  ph.addEventListener("change", function () {
    var f = ph.files && ph.files[0]; if (!f) return;
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      photo = im; st = { z: 1, ox: 0, oy: 0 }; zm.value = 1; zm.disabled = false;
      draw(); URL.revokeObjectURL(url);
    };
    im.onerror = function () { msg.textContent = "Couldn’t read that photo. Try a JPG or PNG."; };
    im.src = url;
  });

  zm.addEventListener("input", function () { st.z = parseFloat(zm.value); draw(); });

  // Drag to reposition
  var drag = null;
  cv.addEventListener("pointerdown", function (e) {
    if (!photo) return;
    drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy };
    cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var k = W / cv.getBoundingClientRect().width;
    st.ox = drag.ox + (e.clientX - drag.x) * k;
    st.oy = drag.oy + (e.clientY - drag.y) * k;
    draw();
  });
  function endDrag() { drag = null; cv.style.cursor = "grab"; }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  // Download as PNG
  dl.addEventListener("click", function () {
    cv.toBlob(function (blob) {
      if (!blob) return;
      var slug = nm.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flyer";
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "COS26-" + slug + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }, "image/png");
  });
})();
