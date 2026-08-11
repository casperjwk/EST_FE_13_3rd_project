import { Outlet } from "react-router";
import Header from "./Header";
import Footer from "./Footer";
import styles from "./MainLayout.module.css";

const MainLayout = () => {
  return (
    <div className={styles.appShell}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
export default MainLayout;
