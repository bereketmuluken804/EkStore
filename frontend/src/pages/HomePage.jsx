import React from "react";
import { useHomeCatalog } from "../hooks/useHomeCatalog";
import { HomeHero } from "../components/HomeHero";
import TrustStrip from "../components/TrustStrip";
import PageError from "../components/PageError";
import {CatalogProductCard} from "../components/CatalogProductCard";

const HomePage = () => {
	const {
		categoryFilter,
		setCategory,
		categories,
		products,
		categoryChipsLoading,
		loadingCategories,
		loadingList,
		error,
	} = useHomeCatalog();
	return (
		<div>
			<HomeHero
				categories={categories}
				loadingCategories={loadingCategories}
			/>

			<TrustStrip />

			<div className="flex flex-col gap-4  mb-6 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold text-base-content md:text-2xl uppercase font-mono">Catelog</h2>
				</div>

				<div>
					<button
						type="button"
						className={`btn btn-sm ${!categoryFilter ? "btn-primary" : "btn-ghost border border-base-300"}`}
						onClick={() => setCategory("")}
					>
						All
					</button>

					{categoryChipsLoading
						? [1, 2, 3, 4].map((i) => (
								<div key={i} className="" />
							))
						: categories.map((c) => (
								<button
									key={c}
									className={`btn btn-sm ${categoryFilter === c ? "btn-primary" : "btn-ghost border border-base-300"}`}
									onClick={() => setCategory(c)}
								>
									{c}
								</button>
							))}
				</div>
			</div>
        {loadingList ? (
         <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
           {[1, 2, 3, 4, 5, 6].map((i) => (
             <li key={i}>
               <div className="skeleton h-96 w-full rounded-box" />
             </li>
           ))}
         </ul>
       ) : error ? (
         <PageError message="We couldn't load products. Please try again in a moment." />
       ) : products.length === 0 ? (
         <div className="rounded-box border border-base-300 bg-base-100 py-16 text-center text-base-content/60">
           No products in this category yet.
         </div>
       ) : (
         <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
           {products.map((p) => (
             <li key={p.id}>
               <CatalogProductCard product={p} />
             </li>
           ))}
         </ul>
       )}
		</div>
	);
};

export default HomePage;
