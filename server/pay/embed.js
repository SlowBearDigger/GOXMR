// GoXMR Pay embed shim. Drop one <script src="https://goxmr.click/pay/embed/pay.js">
// on any page and turn elements with data-goxmr-pay attributes into checkout buttons.
//
// Usage:
//   <button data-goxmr-pay
//           data-order-id="ord_xxx"
//           data-redirect="https://your-site.com/thanks">
//     Pay 0.05 XMR
//   </button>
//
// Opens https://goxmr.click/pay/checkout/<order_id> as a centered popup. Status
// polling and webhook delivery happen entirely server-side on the gateway.

(function () {
    'use strict';
    var BASE = 'https://goxmr.click';

    function openCheckout(orderId) {
        var url = BASE + '/pay/checkout/' + encodeURIComponent(orderId);
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
            // v1 requires the merchant to create the order server-side (POST
            // /pay/v1/orders) and pass the resulting order_id in data-order-id.
            // server-less mode would require shipping an API key to the browser,
            // which would let any visitor mint orders against the merchant's quota.
            console.warn('[goxmr-pay] data-order-id missing. Create the order server-side and pass it in the button attribute.');
            alert('GoXMR Pay: missing data-order-id. See https://goxmr.click/pay/docs');
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
