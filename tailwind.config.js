module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "15%":       { transform: "rotate(10deg)" },
          "30%":       { transform: "rotate(-10deg)" },
          "45%":       { transform: "rotate(6deg)" },
          "60%":       { transform: "rotate(-6deg)" },
          "75%":       { transform: "rotate(2deg)" },
        },
      },
      animation: {
        wiggle: "wiggle 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}