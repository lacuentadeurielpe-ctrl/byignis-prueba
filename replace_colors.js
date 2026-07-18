const fs = require('fs');
const path = require('path');

const dir = 'src/app/auth/login';
const files = [
  'page.tsx',
  '_components/LandingHero.tsx',
  '_components/LandingAgitation.tsx',
  '_components/LandingFeatures.tsx',
  '_components/LandingHowItWorks.tsx',
  '_components/LandingTestimonials.tsx',
  '_components/LandingPricing.tsx',
  '_components/LandingFAQ.tsx',
  '_components/LoginForm.tsx'
];

files.forEach(f => {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/emerald/g, 'blue');
    fs.writeFileSync(p, content);
    console.log(`Replaced in ${f}`);
  }
});
