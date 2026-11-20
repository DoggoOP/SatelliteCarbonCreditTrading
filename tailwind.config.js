/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F0EEE6",
        paper: "#FAF9F5",
        ink: "#141413",
        muted: "#6F6E69",
        canopy: "#6E7F72",
        copper: "#D97757",
        line: "#E4E1D8",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Source Serif 4"', "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(20, 20, 19, 0.03)",
      },
    },
  },
  plugins: [],
};
