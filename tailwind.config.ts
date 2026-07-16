import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0C10",
        panel: "#11141A",
        panel2: "#161A22",
        line: "#232833",
        muted: "#7A8290",
        fg: "#E8EAED",
        rise: "#37C77A",
        riseDim: "#1E6B44",
        fall: "#FF5C5C",
        fallDim: "#7A2626",
        amber: "#F0A84B",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
