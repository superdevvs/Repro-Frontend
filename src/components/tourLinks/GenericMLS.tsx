import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/config/env";

export function GenericMLS() {
  const [slides, setSlides] = useState<string[]>([]);
  const [address, setAddress] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [propertyDetails, setPropertyDetails] = useState<any>(null);
  const [iguideTourUrl, setIguideTourUrl] = useState<string | null>(null);
  const [iguideFloorplans, setIguideFloorplans] = useState<any[]>([]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shootId = params.get('shootId');
      if (shootId) {
        fetch(`${API_BASE_URL}/api/public/shoots/${shootId}/generic-mls`).then(res=>res.json()).then(data=>{
          const imgs: string[] = Array.isArray(data?.photos) ? data.photos : [];
          const vids: string[] = Array.isArray(data?.videos) ? data.videos : [];
          setSlides([...imgs, ...vids]);
          if (data?.shoot) {
            const s = data.shoot;
            // Generic MLS - hide address per requirements
            // setAddress([s.address, s.city, s.state, s.zip].filter(Boolean).join(', '));
            setClientName(data?.shoot?.client_name || "");
          }
          // Set integration data
          if (data?.property_details) {
            setPropertyDetails(data.property_details);
          }
          if (data?.iguide_tour_url) {
            setIguideTourUrl(data.iguide_tour_url);
          }
          if (data?.iguide_floorplans) {
            setIguideFloorplans(Array.isArray(data.iguide_floorplans) ? data.iguide_floorplans : []);
          }
        }).catch(()=>{});
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Toggle mobile menu
    const btn = document.getElementById("menu-btn");
    const menu = document.getElementById("menu");
    function onMenuClick() {
      menu?.classList.toggle("hidden");
    }
    btn?.addEventListener("click", onMenuClick);

    // footer year
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    // --- Gallery controller (ported from original) ---
    (function () {
      const AUTOPLAY_INTERVAL = 3000;
      const ZOOM_STEP = 0.25;
      const ZOOM_MAX = 3;
      const ZOOM_MIN = 1;

      function createGalleryController(options) {
        const { thumbSelector, modalIdPrefix, initialSlides = null } = options;
        const thumbs = Array.from(document.querySelectorAll(thumbSelector));
        const popup = document.getElementById(modalIdPrefix + "popup");
        if (!popup) return null;

        const slidesContainer = document.getElementById(modalIdPrefix + "-slides");
        const closeBtn = document.getElementById(modalIdPrefix + "closePopup") || document.getElementById(modalIdPrefix + "close");
        const prevBtn = document.getElementById(modalIdPrefix + "Prev");
        const nextBtn = document.getElementById(modalIdPrefix + "Next");
        const playPauseBtn = document.getElementById(modalIdPrefix + "PlayPause");
        const ppIcon = document.getElementById(modalIdPrefix + "PpIcon");
        const ppLabel = document.getElementById(modalIdPrefix + "PpLabel");
        const caption = document.getElementById(modalIdPrefix + "-caption");
        const counter = document.getElementById(modalIdPrefix + "-counter");
        const zoomInBtn = document.getElementById(modalIdPrefix + "ZoomIn");
        const zoomOutBtn = document.getElementById(modalIdPrefix + "ZoomOut");
        const fsBtn = document.getElementById(modalIdPrefix + "Fullscreen");

        const images = (initialSlides && initialSlides.length)
          ? initialSlides
          : (thumbs.length ? thumbs.map((t) => t.getAttribute("src") || "") : []);
        let current = 0;
        let autoplayId = null;
        let isPlaying = false;
        let touchStartX = 0;
        let zoomScale = 1;
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let imgOffsetX = 0;
        let imgOffsetY = 0;
        let lastTapTime = 0;
        let activeImgPointerDown = false;

        if (!slidesContainer) {
          console.warn("slidesContainer missing for", modalIdPrefix);
          return null;
        }

        function buildSlides() {
          slidesContainer.innerHTML = "";
          images.forEach((src, i) => {
            const wrap = document.createElement("div");
            wrap.className = "slide hidden w-full flex items-center justify-center";
            wrap.setAttribute("data-index", String(i));

            const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(src || "");
            if (isVideo) {
              const v = document.createElement("video");
              v.src = src;
              v.controls = true;
              v.className = "block mx-auto w-auto max-w-full max-h-[85vh] object-contain rounded-lg";
              wrap.appendChild(v);
            } else {
              const img = document.createElement("img");
              img.src = src;
              img.alt = `Slide ${i + 1}`;
              img.className = "gallery-image block mx-auto w-auto max-w-full max-h-[85vh] object-contain rounded-lg touch-none";
              img.draggable = false;
              wrap.appendChild(img);
            }
            slidesContainer.appendChild(wrap);
          });
        }

        function getActiveSlide() {
          return slidesContainer.querySelector(".slide:not(.hidden)");
        }
        function getActiveMedia() {
          const s = getActiveSlide();
          return s ? (s.querySelector("img") || s.querySelector("video")) : null;
        }

        function applyTransformToActive() {
          const media = getActiveMedia();
          if (!media) return;
          if (media.tagName === "IMG") {
            media.style.transform = `translate(${imgOffsetX}px, ${imgOffsetY}px) scale(${zoomScale})`;
            media.style.transition = "transform 0.05s ease-out";
            media.style.cursor = zoomScale > 1 ? "grab" : "auto";
            media.style.touchAction = zoomScale > 1 ? "none" : "pan-y";
          }
        }

        function resetZoom() {
          zoomScale = 1;
          imgOffsetX = 0;
          imgOffsetY = 0;
          const media = getActiveMedia();
          if (media && media.tagName === "IMG") {
            media.style.transform = "";
            media.style.cursor = "";
            media.style.transition = "";
            media.style.touchAction = "";
          }
        }

        function showSlide(index) {
          if (!images.length) return;
          index = ((index % images.length) + images.length) % images.length;
          current = index;
          resetZoom();
          const slides = slidesContainer.querySelectorAll(".slide");
          slides.forEach((s) => s.classList.add("hidden"));
          const active = slidesContainer.querySelector(`.slide[data-index="${index}"]`);
          if (active) active.classList.remove("hidden");

          const src = images[index];
          const fileName = src ? src.split("/").pop() : `Slide ${index + 1}`;
          if (caption) caption.textContent = fileName || "";
          if (counter) counter.textContent = `${index + 1} / ${images.length}`;
          thumbs.forEach((t) => t.classList.remove("ring-4", "ring-white", "ring-offset-2"));
          const thumb = thumbs[index];
          if (thumb) thumb.classList.add("ring-4", "ring-white", "ring-offset-2");
        }

        function openPopup(index) {
          buildSlides();
          showSlide(index || 0);
          popup.classList.remove("hidden");
          document.documentElement.style.overflow = "hidden";
          attachImageEventListeners();
        }
        function closePopup() {
          popup.classList.add("hidden");
          stopAutoplay();
          document.documentElement.style.overflow = "";
          detachImageEventListeners();
        }

        function next() { showSlide(current + 1); }
        function prev() { showSlide(current - 1); }

        function startAutoplay() {
          if (isPlaying || images.length <= 1) return;
          isPlaying = true;
          if (ppIcon) ppIcon.textContent = "⏸";
          if (ppLabel) ppLabel.textContent = "Pause";
          autoplayId = setInterval(() => next(), AUTOPLAY_INTERVAL);
        }
        function stopAutoplay() {
          if (!isPlaying) return;
          isPlaying = false;
          if (ppIcon) ppIcon.textContent = "▶";
          if (ppLabel) ppLabel.textContent = "Play";
          clearInterval(autoplayId);
          autoplayId = null;
        }
        function toggleAutoplay() { if (isPlaying) stopAutoplay(); else startAutoplay(); }
        function restartAutoplay() { stopAutoplay(); startAutoplay(); }

        thumbs.forEach((t, i) => {
          t.addEventListener("click", () => openPopup(i));
          t.setAttribute("tabindex", "0");
          t.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); t.click(); } });
        });

        closeBtn?.addEventListener("click", closePopup);
        prevBtn?.addEventListener("click", () => { prev(); if (isPlaying) restartAutoplay(); });
        nextBtn?.addEventListener("click", () => { next(); if (isPlaying) restartAutoplay(); });
        playPauseBtn?.addEventListener("click", toggleAutoplay);

        zoomInBtn?.addEventListener("click", () => { zoomScale = Math.min(zoomScale + ZOOM_STEP, ZOOM_MAX); applyTransformToActive(); });
        zoomOutBtn?.addEventListener("click", () => { zoomScale = Math.max(zoomScale - ZOOM_STEP, ZOOM_MIN); if (zoomScale === 1) { imgOffsetX = 0; imgOffsetY = 0; } applyTransformToActive(); });

        fsBtn?.addEventListener("click", async () => {
          try { if (!document.fullscreenElement) await popup.requestFullscreen(); else await document.exitFullscreen(); } catch (err) { console.warn(err); }
        });

        popup.addEventListener("click", (e) => { if (e.target === popup) closePopup(); });

        function keyHandler(e) {
          if (popup.classList.contains("hidden")) return;
          if (e.key === "ArrowRight") { next(); if (isPlaying) restartAutoplay(); }
          if (e.key === "ArrowLeft") { prev(); if (isPlaying) restartAutoplay(); }
          if (e.key === "Escape") closePopup();
        }
        document.addEventListener("keydown", keyHandler);

        slidesContainer.addEventListener("touchstart", (e) => { if (zoomScale > 1) return; touchStartX = e.changedTouches[0].clientX; });
        slidesContainer.addEventListener("touchend", (e) => {
          if (zoomScale > 1) return;
          const touchEndX = e.changedTouches[0].clientX; const dx = touchEndX - touchStartX;
          if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); if (isPlaying) restartAutoplay(); }
        });

        function attachImageEventListeners() {
          slidesContainer.addEventListener("pointerdown", onPointerDown);
          slidesContainer.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", onPointerUp);
          slidesContainer.addEventListener("dblclick", (e) => toggleDoubleClickZoom(e.clientX, e.clientY));
          slidesContainer.addEventListener("touchend", (e) => {
            const now = Date.now(); const gap = now - lastTapTime; lastTapTime = now;
            if (gap < 300 && gap > 0) { const t = e.changedTouches[0]; toggleDoubleClickZoom(t.clientX, t.clientY); }
          });
        }
        function detachImageEventListeners() {
          slidesContainer.removeEventListener("pointerdown", onPointerDown);
          slidesContainer.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
        }

        function onPointerDown(e) {
          const media = getActiveMedia(); if (!media || media.tagName !== "IMG") return;
          if (zoomScale <= 1) return;
          isDragging = true; activeImgPointerDown = true;
          dragStartX = e.clientX - imgOffsetX; dragStartY = e.clientY - imgOffsetY;
          try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) { }
          media.style.cursor = "grabbing";
        }
        function onPointerMove(e) { if (!isDragging) return; imgOffsetX = e.clientX - dragStartX; imgOffsetY = e.clientY - dragStartY; applyTransformToActive(); }
        function onPointerUp(e) {
          if (!activeImgPointerDown) return;
          isDragging = false; activeImgPointerDown = false;
          const media = getActiveMedia();
          if (media && media.tagName === "IMG") media.style.cursor = "grab";
          clampImageOffset();
        }
        function clampImageOffset() {
          const img = getActiveMedia(); if (!img || img.tagName !== "IMG") return;
          const rect = img.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight;
          const scaledWidth = rect.width; const scaledHeight = rect.height;
          const maxX = Math.max(0, (scaledWidth - vw) / 2 + 50); const maxY = Math.max(0, (scaledHeight - vh) / 2 + 50);
          imgOffsetX = Math.max(-maxX, Math.min(maxX, imgOffsetX));
          imgOffsetY = Math.max(-maxY, Math.min(maxY, imgOffsetY));
          applyTransformToActive();
        }
        function toggleDoubleClickZoom(clientX, clientY) {
          const media = getActiveMedia(); if (!media || media.tagName !== "IMG") return;
          const rect = media.getBoundingClientRect();
          const clickX = clientX - rect.left; const clickY = clientY - rect.top;
          if (zoomScale === 1) {
            zoomScale = Math.min(2, ZOOM_MAX);
            const dx = (rect.width / 2 - clickX) * (zoomScale - 1);
            const dy = (rect.height / 2 - clickY) * (zoomScale - 1);
            imgOffsetX += dx; imgOffsetY += dy;
          } else { zoomScale = 1; imgOffsetX = 0; imgOffsetY = 0; }
          applyTransformToActive(); clampImageOffset();
        }

        if (images.length) buildSlides();

        return { open: openPopup, close: closePopup, show: showSlide, startAutoplay, stopAutoplay, toggleAutoplay };
      }

      try {
        createGalleryController({ thumbSelector: ".thumb", modalIdPrefix: "photo", initialSlides: slides.length ? slides : null });
        createGalleryController({ thumbSelector: ".video-thumb", modalIdPrefix: "video", initialSlides: slides.length ? slides : null });
        createGalleryController({ thumbSelector: ".gallery-img", modalIdPrefix: "floor", initialSlides: slides.length ? slides : null });
      } catch (err) {
        console.error("Error creating gallery controllers", err);
      }
    })();

    // cleanup
    return () => {
      btn?.removeEventListener("click", onMenuClick);
      // Full teardown of gallery event listeners would require tracking all handlers.
    };
  }, [slides]);

  return (
    <div>
      <div className="top-0 mb-4 relative">
        <img src="/images/bg.jpg" alt="Banner Image" className="w-full h-full object-cover" />
        <div className="absolute top-0 left-0 w-full h-full bg-black/40 z-10" />
      </div>

      <nav className="bg-transparent backdrop-blur-md shadow-md fixed top-0 left-0 w-full z-50 rounded-3xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="hidden md:flex items-center space-x-6 font-semibold">
              <a href="#photo" className="text-gray-700 hover:text-white">Photo</a>
              <a href="#video" className="text-gray-700 hover:text-white">Video</a>
              <a href="#3dtour" className="text-gray-700 hover:text-white">3D Tour</a>
              <a href="#floorplan" className="text-gray-700 hover:text-white">Floor Plan</a>
              <a href="#contact" className="block text-gray-700 hover:text-white">Contact</a>
            </div>

            <div className="md:hidden flex items-center">
              <button id="menu-btn" className="text-gray-700 focus:outline-none" aria-label="menu">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div id="menu" className="hidden md:hidden px-4 pb-4 space-y-2 bg-transparent backdrop-blur-md shadow-md">
          <a href="#photo" className="block text-gray-700 hover:text-white">Photo</a>
          <a href="#video" className="block text-gray-700 hover:text-white">Video</a>
          <a href="#3dtour" className="block text-gray-700 hover:text-white">3D Tour</a>
          <a href="#floorplan" className="block text-gray-700 hover:text-white">Floor Plan</a>
          <a href="#contact" className="block text-gray-700 hover:text-white">Contact</a>
        </div>
      </nav>

      {(propertyDetails?.beds || propertyDetails?.baths || propertyDetails?.sqft) && (
        <div className="w-full px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-around text-gray-700 text-sm md:text-base mt-20">
          {propertyDetails.beds && (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M4 6h16a1 1 0 011 1v8H3V7a1 1 0 011-1zM21 16H3v4h18v-4z" />
              </svg>
              <span className="font-medium">{propertyDetails.beds} Bedroom{propertyDetails.beds !== 1 ? 's' : ''}</span>
            </div>
          )}

          {propertyDetails.baths && (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 13h16v8H4v-8zM4 9h16V7a1 1 0 00-1-1h-5V3h-4v3H5a1 1 0 00-1 1v2z" />
              </svg>
              <span className="font-medium">{propertyDetails.baths} Bathroom{propertyDetails.baths !== 1 ? 's' : ''}</span>
            </div>
          )}

          {propertyDetails.sqft && (
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M12 3v18" />
              </svg>
              <span className="font-medium">{propertyDetails.sqft.toLocaleString()} sq.ft</span>
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      <section id="photo" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-black mb-8">PHOTOS</h2>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="photos-grid">
            {(slides.length ? slides : []).map((src, idx) => (
              <img key={idx} data-index={idx} src={src} className="thumb w-full rounded-lg shadow-md hover:opacity-90 cursor-pointer object-cover h-48" alt={`Photo ${idx+1}`} />
            ))}
          </div>
        </div>

        <div id="photopopup" className="fixed inset-0 z-[9999] hidden grid place-items-center bg-black/80 p-4">
          <button id="photoclosePopup" className="absolute top-4 right-4 text-white text-3xl leading-none focus:outline-none" aria-label="Close">×</button>

          <div className="w-full max-w-6xl pointer-events-auto relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-6 z-20 flex items-center gap-2 bg-gray-800/70 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg">
              <button id="photoPrev" className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 focus:outline-none" aria-label="Previous">‹</button>
              <button id="photoPlayPause" className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none"><span id="photoPpIcon" /></button>
              <button id="photoZoomIn" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 focus:outline-none" aria-label="Zoom In">＋</button>
              <button id="photoZoomOut" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 focus:outline-none" aria-label="Zoom Out">－</button>
              <button id="photoFullscreen" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 focus:outline-none" aria-label="Fullscreen">⛶</button>
              <button id="photoNext" className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 focus:outline-none" aria-label="Next">›</button>
            </div>

            <div id="photo-slides" className="bg-transparent rounded-lg overflow-hidden" />

            <div className="mt-4 flex items-center justify-between text-sm text-white/90">
              <div id="photo-caption" className="truncate max-w-[70%]" />
              <div id="photo-counter" className="opacity-90" />
            </div>
          </div>
        </div>
      </section>

      {/* 3D Tour Section */}
      {iguideTourUrl && (
        <section id="3dtour" className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-black mb-8">3D TOUR</h2>
            <div className="flex justify-center">
              <iframe
                src={iguideTourUrl}
                className="w-full aspect-video rounded-lg shadow-md"
                allow="fullscreen"
                style={{ minHeight: '500px' }}
                title="iGUIDE 3D Tour"
              />
            </div>
          </div>
        </section>
      )}

      {/* Floorplans Section */}
      {iguideFloorplans && iguideFloorplans.length > 0 && (
        <section id="floorplan" className="py-16 bg-gray-50">
          <div className="flex justify-center items-center min-h-screen">
            <div className="w-full max-w-6xl p-6">
              <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10 text-black">FLOOR PLANS</h2>
              <div id="gallery" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {iguideFloorplans.map((floorplan: any, idx: number) => {
                  const url = typeof floorplan === 'string' ? floorplan : (floorplan.url || floorplan.path);
                  return (
                    <img
                      key={idx}
                      src={url}
                      alt={floorplan.filename || `Floorplan ${idx + 1}`}
                      className="gallery-img w-full h-auto rounded-lg shadow-md hover:opacity-90 cursor-pointer object-cover"
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex justify-center items-center py-16 px-4" id="contact">
        <form className="bg-white p-8 rounded-lg shadow-md w-full max-w-md flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-center text-black">CONTACT</h2>
          <input type="text" placeholder="Name" className="border border-blue-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" placeholder="Email Address" className="border border-blue-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea placeholder="Message" rows="4" className="border border-blue-900 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition font-semibold">SEND</button>
        </form>
      </div>

      <p className="w-full py-3 text-center text-xs text-black dark:text-black border-t">© <span id="year"></span> R/E Pro Photos — All rights reserved.</p>
    </div>
  );
}
