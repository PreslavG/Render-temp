import Logo from "./Logo";

export default function LayoutNoNav({ children }) {
  return (
    <>
       <Logo/>
      {children}
    </>
  );
}