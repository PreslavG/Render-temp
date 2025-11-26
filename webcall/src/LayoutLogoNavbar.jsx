import Navbar from "./Navbar";
import Logo from "./Logo";

export default function Layout({ children }) {
  return (
    <>
      <header>
        <Logo />
        <Navbar />
      </header>

      <main>
        {children}
      </main>
    </>
  );
}