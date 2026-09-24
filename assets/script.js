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

  // FAQ accordion — animates .faq-answer's height instead of letting
  // <details> snap open/closed instantly. Click is intercepted (this
  // also catches Enter/Space activation, which browsers dispatch as a
  // click on <summary>) so `open` and the height animation stay in sync.
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".faq-list details").forEach(function (details) {
    var summary = details.querySelector("summary");
    var answer = details.querySelector(".faq-answer");
    if (!summary || !answer) return;

    function onTransitionEnd(handler) {
      function wrapped(event) {
        if (event.target !== answer || event.propertyName !== "height") return;
        answer.removeEventListener("transitionend", wrapped);
        handler();
      }
      answer.addEventListener("transitionend", wrapped);
    }

    function openAnswer() {
      details.open = true;

      if (reduceMotion) {
        answer.style.height = "auto";
        return;
      }

      var target = answer.scrollHeight;
      answer.style.height = "0px";
      // Force layout so the browser registers the 0px start height
      // before the target height change, or it collapses the transition.
      answer.offsetHeight;
      answer.style.transition = "height 0.3s ease";
      answer.style.height = target + "px";

      onTransitionEnd(function () {
        answer.style.height = "auto";
      });
    }

    function closeAnswer() {
      if (reduceMotion) {
        details.open = false;
        answer.style.height = "0px";
        return;
      }

      answer.style.height = answer.scrollHeight + "px";
      answer.offsetHeight;
      answer.style.transition = "height 0.3s ease";
      answer.style.height = "0px";

      onTransitionEnd(function () {
        details.open = false;
      });
    }

    summary.addEventListener("click", function (event) {
      event.preventDefault();
      if (details.open) {
        closeAnswer();
      } else {
        openAnswer();
      }
    });
  });

  // "Signal lost -> escalating" list: on widescreen the rest of that
  // column is right-aligned, but this list reads dot-then-text and is
  // recentered under "Studesafe alerts..." above it instead — a look
  // CSS can't produce on its own, since the two lines' natural widths
  // differ too much for a plain center to land in the right place.
  var escalationList = document.querySelector(".escalation-steps");
  var escalationLine = escalationList && escalationList.previousElementSibling;
  var wideMql = window.matchMedia("(min-width: 720px)");

  function alignEscalationList() {
    if (!escalationLine) return;

    if (!wideMql.matches) {
      escalationList.style.marginRight = "";
      return;
    }

    var firstItem = escalationList.querySelector("li");
    if (!firstItem) return;

    escalationList.style.marginRight = "0px";
    var lineRect = escalationLine.getBoundingClientRect();
    var lineCenter = (lineRect.left + lineRect.right) / 2;

    // The dot (li::before) sits 0.15em inset from the <li>'s left edge
    // and is 6px wide — its own center, not the list block's center, is
    // what should land on the line's center.
    var itemRect = firstItem.getBoundingClientRect();
    var fontSize = parseFloat(getComputedStyle(firstItem).fontSize);
    var dotCenter = itemRect.left + fontSize * 0.15 + 3;

    var shift = dotCenter - lineCenter;
    escalationList.style.marginRight = Math.max(0, shift) + "px";
  }

  if (escalationList) {
    alignEscalationList();
    window.addEventListener("resize", alignEscalationList);
    wideMql.addEventListener("change", alignEscalationList);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(alignEscalationList);
    }
  }
})();
