const fs = require('fs');
const file = '/Users/sam/Desktop/GSJA/sia-gsja/gsja/src/components/layouts/JemaatPwaLayout.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  "import PushNotificationManager from '@/components/ui/PushNotificationManager';",
  `import PushNotificationManager from '@/components/ui/PushNotificationManager';\nimport dynamic from 'next/dynamic';\n\nconst Lottie = dynamic(() => import('lottie-react'), { ssr: false });\nimport scanQrLottie from '../../../public/assets/scan-qr-code.json';`
);

// 2. State & Direction Logic
content = content.replace(
  "const [isTransitioning, setIsTransitioning] = useState(false);",
  `const [showQrOptions, setShowQrOptions] = useState(false);\n  const [isTransitioning, setIsTransitioning] = useState(false);`
);

content = content.replace(
  "const [displayPath, setDisplayPath] = useState(pathname);\n  const prevPathRef = useRef(pathname);",
  `const [displayPath, setDisplayPath] = useState(pathname);\n  const prevPathRef = useRef(pathname);\n  const historyRef = useRef(['/']);\n  const directionRef = useRef('forward');\n\n  if (pathname !== prevPathRef.current) {\n    const h = historyRef.current;\n    if (h.length > 1 && h[h.length - 2] === pathname) {\n      directionRef.current = 'backward';\n      h.pop();\n    } else {\n      directionRef.current = 'forward';\n      h.push(pathname);\n    }\n    prevPathRef.current = pathname;\n  }`
);

// 3. Remove old transition useEffect
content = content.replace(/useEffect\(\(\) => \{\n    if \(pathname !== prevPathRef\.current\) \{[\s\S]*?\}, \[pathname\]\);\n/g, "");

// 4. navItems
content = content.replace(
  "active: pathname === '/dashboard'",
  "active: pathname === '/' || pathname === '/dashboard'"
);

// 5. CSS
content = content.replace(
  /\{\/\* PAGE TRANSITION STYLES \*\/\}[\s\S]*?<\/style>/,
  `{/* PAGE TRANSITION STYLES */}
      <style>{\`
        .pwa-page-enter-forward {
          animation: slideInRight 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .pwa-page-enter-backward {
          animation: slideInLeft 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        
        @keyframes slideInRight {
          from { transform: translateX(30%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-30%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes icon-breath {
          0% { transform: scale(1.1); filter: drop-shadow(0 0px 0px rgba(37,99,235,0)); }
          50% { transform: scale(1.25); filter: drop-shadow(0 4px 10px rgba(37,99,235,0.4)); }
          100% { transform: scale(1.1); filter: drop-shadow(0 0px 0px rgba(37,99,235,0)); }
        }

        @keyframes qr-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes qr-pop-left {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          60% { transform: translate(-78px, -135px) scale(1.08); opacity: 1; }
          100% { transform: translate(-70px, -120px) scale(1); opacity: 1; }
        }
        @keyframes qr-pop-right {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          60% { transform: translate(78px, -135px) scale(1.08); opacity: 1; }
          100% { transform: translate(70px, -120px) scale(1); opacity: 1; }
        }
        @keyframes qr-label-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes qr-close-in {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      \`}</style>`
);

// 6. Main
content = content.replace(
  /<main[\s\S]*?>/,
  `<main\n        key={pathname}\n        className={\`flex-1 w-full pb-24 overflow-y-auto pwa-page-enter-\${directionRef.current}\`}\n      >`
);

// 7. Menu Kiri
content = content.replace(
  /{navItems\[0\]\.icon}<\/span>/,
  `{navItems[0].icon}</span>` // Need to do this properly
);

fs.writeFileSync(file, content);
