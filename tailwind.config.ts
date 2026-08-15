import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* 品牌主色:朱砂(vermilion)——纸墨之上的一点印泥红 */
        brand: {
          50: "#faf1ec",
          100: "#f3ddd1",
          200: "#e6b9a3",
          300: "#d68f70",
          400: "#c76a45",
          500: "#b94a26",
          600: "#a03e20",
          700: "#7c2f18",
        },
        /* 墨与纸 */
        ink: {
          50: "#f6f5f2",
          100: "#e8e6e0",
          200: "#d4d0c7",
          300: "#b0aa9c",
          400: "#8a8375",
          500: "#6b6457",
          600: "#4d473c",
          700: "#38332b",
          800: "#26221d",
          900: "#1c1917",
        },
        paper: "#f7f4ec",
      },
      fontFamily: {
        display: ['"Songti SC"', '"STSong"', '"Noto Serif SC"', '"Source Han Serif SC"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
