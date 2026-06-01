// GoXMR Pay embed shim. Drop one <script src="https://money.goxmr.click/pay/embed/pay.js">
// on any page and turn elements with data-goxmr-pay attributes into checkout buttons.
//
// Usage:
//   <button data-goxmr-pay
//           data-merchant="mch_xxx"  (or full api creates the order ahead of time)
//           data-amount="0.05"
//           data-currency="XMR"
//           data-order-id="ORDER-42"
//           data-redirect="https://your-site.com/thanks">
//     Pay 0.05 XMR
//   </button>
//
// The shim opens money.goxmr.click/checkout/<order_id> as a centered popup. Status
// polling and webhook delivery happen entirely server-side on the gateway.

(function () {
    'use strict';
    var BASE = 'https://money.goxmr.click';

    function openCheckout(orderId) {
        var url = BASE + '/checkout/' + encodeURIComponent(orderId);
        var w = 480, h = 720;
        var x = (screen.width - w) / 2;
        var y = (screen.height - h) / 2;
        window.open(url, 'goxmr_pay', 'width=' + w + ',height=' + h + ',left=' + x + ',top=' + y + ',resizable=yes,scrollbars=yes');
    }

    function bindOne(el) {
        if (el.__goxmrBound) return;
        el.__goxmrBound = true;
        el.addEventListener('click', function (e) {
            e.preventDefault();
            var orderId = el.getAttribute('data-order-id');
            if (orderId) return openCheckout(orderId);
            // Server-less mode: hit the public create endpoint with merchant + amount
            // (this requires merchant to expose a "public price" endpoint or have a
            // pre-shared API key, which is bad practice for embed. v1 requires that
            // the merchant create the order server-side and pass data-order-id here.)
            console.warn('[goxmr-pay] data-order-id missing. Create the order server-side and pass it in the button attribute.');
            alert('GoXMR Pay: missing data-order-id. See https://money.goxmr.click/docs');
        });
    }

    function bindAll() {
        var els = document.querySelectorAll('[data-goxmr-pay]');
        for (var i = 0; i < els.length; i++) bindOne(els[i]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAll);
    } else {
        bindAll();
    }
    // Re-bind for SPAs that inject buttons later.
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(bindAll).observe(document.documentElement, { childList: true, subtree: true });
    }

    window.GoXMRPay = { open: openCheckout, rebind: bindAll, version: 1 };
})();
