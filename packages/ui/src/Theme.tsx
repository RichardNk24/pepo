import { createContext, useContext, type ReactNode } from "react";
import { C } from "@pepo/config/tokens";
export type ThemeName = "classic" | "purple" | "mono";
export const palettes = {
  classic: { ...C, themeName:"classic", accentDark:C.green, accentSoft:C.greenSoft, onAccent: C.ink, accentOnInk: C.yellow },
  purple: {
    themeName:"purple", accentDark:"#520099", accentSoft:"#F3E8FF",
    ...C,
    yellow: "#8000FF",
    yellowSoft: "#F3E8FF",
    onAccent: "#FFFFFF",
    accentOnInk: "#DDB5FF",
  },
  mono: {
    themeName:"mono", accentDark:"#20221F", accentSoft:"#EEEEEE",
    ...C,
    yellow: "#20221F",
    yellowSoft: "#EEEEEE",
    onAccent: "#FFFFFF",
    accentOnInk: "#FFFFFF",
  },
};
const ThemeContext = createContext(palettes.classic);
export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeName;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={palettes[theme]}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useThemeColors = () => useContext(ThemeContext);
