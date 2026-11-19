/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f3efe6",
        paper: "#fffcf7",
        ink: "#14221b",
        muted: "#5c6b62",
        canopy: "#146c43",
        copper: "#b8612e",
        line: "#e2d9cc",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(20, 34, 27, 0.04), 0 12px 40px rgba(20, 34, 27, 0.06)",
      },
    },
  },
  plugins: [],
};
