import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme immediately to prevent flash
const storedTheme = localStorage.getItem('theme_pref');
if (storedTheme === 'dark' || (storedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.add('light');
}

createRoot(document.getElementById("root")!).render(<App />);
