// Set Current Year in Footer
const currentYearEl = document.getElementById('current-year');
if (currentYearEl) {
  currentYearEl.textContent = new Date().getFullYear();
}

// Translation dictionaries for shared elements (Menu & Footer)
const sharedTranslations = {
  es: {
    toggleBtn: "🌐 English",
    navHome: "Inicio",
    navPrivacy: "Privacidad",
    navTerms: "Términos",
    navSafety: "Seguridad",
    footerHome: "Inicio",
    footerPrivacy: "Política de Privacidad",
    footerTerms: "Términos de Servicio",
    footerSafety: "Seguridad Infantil"
  },
  en: {
    toggleBtn: "🌐 Español",
    navHome: "Home",
    navPrivacy: "Privacy",
    navTerms: "Terms",
    navSafety: "Safety",
    footerHome: "Home",
    footerPrivacy: "Privacy Policy",
    footerTerms: "Terms of Service",
    footerSafety: "Child Safety"
  }
};

// Function to update visibility and menu text based on active language
function updateLanguage() {
  const currentLang = localStorage.getItem('meetflow-lang') || 'es';
  const t = sharedTranslations[currentLang];
  
  // Update toggle button text
  const langToggleBtn = document.getElementById('lang-toggle-btn');
  if (langToggleBtn) {
    langToggleBtn.textContent = t.toggleBtn;
  }
  
  // Update menu links
  const navHome = document.getElementById('nav-home'); if (navHome) navHome.textContent = t.navHome;
  const navPrivacy = document.getElementById('nav-privacy'); if (navPrivacy) navPrivacy.textContent = t.navPrivacy;
  const navTerms = document.getElementById('nav-terms'); if (navTerms) navTerms.textContent = t.navTerms;
  const navSafety = document.getElementById('nav-safety'); if (navSafety) navSafety.textContent = t.navSafety;
  
  // Update footer links
  const footerHome = document.getElementById('footer-home'); if (footerHome) footerHome.textContent = t.footerHome;
  const footerPrivacy = document.getElementById('footer-privacy'); if (footerPrivacy) footerPrivacy.textContent = t.footerPrivacy;
  const footerTerms = document.getElementById('footer-terms'); if (footerTerms) footerTerms.textContent = t.footerTerms;
  const footerSafety = document.getElementById('footer-safety'); if (footerSafety) footerSafety.textContent = t.footerSafety;

  // Show all elements for current language, hide others
  document.querySelectorAll('.lang-es').forEach(el => {
    el.style.display = currentLang === 'es' ? 'block' : 'none';
  });
  document.querySelectorAll('.lang-en').forEach(el => {
    el.style.display = currentLang === 'en' ? 'block' : 'none';
  });
}

// Toggle language and save preference in localStorage
function toggleLanguage() {
  const currentLang = localStorage.getItem('meetflow-lang') || 'es';
  const newLang = currentLang === 'es' ? 'en' : 'es';
  localStorage.setItem('meetflow-lang', newLang);
  updateLanguage();
}

// Auto detect browser language on first load if preference is not set
if (!localStorage.getItem('meetflow-lang')) {
  const browserLang = navigator.language || navigator.userLanguage;
  const initialLang = (browserLang && browserLang.toLowerCase().startsWith('en')) ? 'en' : 'es';
  localStorage.setItem('meetflow-lang', initialLang);
}

// Apply language on load
document.addEventListener('DOMContentLoaded', updateLanguage);
updateLanguage();
