(function () {
  "use strict";

  var hamburger = document.getElementById("hamburger");
  var body = document.body;

  if (!hamburger) return;

  function isOpen() {
    return body.classList.contains("nav-open");
  }

  function openMenu() {
    body.classList.add("nav-open");
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "Close menu");
  }

  function closeMenu() {
    body.classList.remove("nav-open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "Open menu");
  }

  hamburger.addEventListener("click", function () {
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Closing via any link in the overlay (including the CTA button)
  document.querySelectorAll(".nav-overlay a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  // Escape closes the menu
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen()) {
      closeMenu();
      hamburger.focus();
    }
  });

  // If the viewport grows past the mobile breakpoint while the menu is
  // open (e.g. rotating a tablet, or a resize during dev), don't leave
  // the page stuck with scroll locked and an overlay that can't be
  // reached anymore.
  var mql = window.matchMedia("(min-width: 880px)");
  mql.addEventListener("change", function (event) {
    if (event.matches && isOpen()) {
      closeMenu();
    }
  });
})();
