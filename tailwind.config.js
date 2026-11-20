/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14221c",
        paper: "#f3f0e8",
        moss: "#1c6b45",
        pine: "#0e2f24",
        gold: "#8a5a12",
        line: "#e4dfd4",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 18px 50px rgba(20, 34, 28, 0.08)",
      },
    },
  },
  plugins: [],
};
