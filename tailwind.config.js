/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f1ea",
        paper: "#fbfaf6",
        ink: "#1a2820",
        muted: "#5c6a62",
        canopy: "#1f6a45",
        copper: "#a85c34",
        line: "#e3dacd",
      },
      fontFamily: {
        sans: ['"Source Sans 3"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(26, 40, 32, 0.05), 0 16px 40px rgba(26, 40, 32, 0.06)",
      },
    },
  },
  plugins: [],
};
