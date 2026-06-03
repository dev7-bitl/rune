import { ThemeProvider } from "./features/theme";
import { MainLayout } from "./app/MainLayout";
import "./styles/index.css";

export default function App() {
  return (
    <ThemeProvider>
      <MainLayout />
    </ThemeProvider>
  );
}
