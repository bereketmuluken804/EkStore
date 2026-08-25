import {
	Show,
	SignInButton,
	SignUpButton,
	UserButton,
	useAuth,
} from "@clerk/react";
import PageLoader from "./components/PageLoader";
import Layout from "./components/Layout";
function App() {
	const { isLoaded } = useAuth();
	if (!isLoaded) return <PageLoader />;
	return (
		<div>
			<Layout>
				<header>
					<Show when="signed-out">
						<SignInButton mode="modal" />
						<SignUpButton mode="modal" />
					</Show>
					<Show when="signed-in">
						<UserButton />
					</Show>
				</header>
				<h2 className="text-amber-200 p-2 text-4xl font-bold">Test</h2>
				<button className="btn btn-primary">Click</button>
				<button className="btn btn-info">Click</button>
				<button className="btn btn-outline">Click</button>
			</Layout>
		</div>
	);
}
export default App;
