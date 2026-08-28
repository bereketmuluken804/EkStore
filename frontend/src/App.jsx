import {
	Show,
	SignInButton,
	SignUpButton,
	UserButton,
	useAuth,
} from "@clerk/react";
import PageLoader from "./components/PageLoader";
import Layout from "./components/Layout";
import { Route, Routes } from "react-router";
import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import CheckoutReturnPage from "./pages/CheckoutReturnPage";

function App() {
	const { isLoaded } = useAuth();
	if (!isLoaded) return <PageLoader />;
	return (
		<div>
			<Layout>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/cart" element={<CartPage />} />
					<Route path="/checkout/return" element={<CheckoutReturnPage />} />
				</Routes>
			</Layout>
		</div>
	);
}
export default App;
