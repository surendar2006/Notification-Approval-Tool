import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import "./App.css";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("app-theme") || "light");

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  return (
    <>
      <Dashboard />
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </>
  );
}
