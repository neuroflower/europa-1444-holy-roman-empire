// Count visits to the published game only; local previews stay offline.
(() => {
  if (location.origin !== 'https://neuroflower.github.io' ||
      !location.pathname.startsWith('/europa-1444-holy-roman-empire/')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-PKLK8200GT', {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-PKLK8200GT';
  document.head.append(script);
})();
