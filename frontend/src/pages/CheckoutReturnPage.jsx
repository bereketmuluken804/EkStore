import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { CheckCircleIcon, PackageIcon, ShoppingCartIcon } from "lucide-react";
import { UseCart } from "../store/cart";

export default function CheckoutReturnPage() {
  const [searchParams] = useSearchParams();
  const checkoutId = searchParams.get("checkout_id");
  const clear = UseCart((s) => s.clear);

  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <CheckCircleIcon className="size-16 text-success" aria-hidden />
      <h1 className="text-3xl font-bold text-base-content">Payment received</h1>
      <p className="max-w-md text-base-content/70">
        Thanks for your order. Your payment is being processed — you will receive a
        confirmation email shortly.
      </p>
      {checkoutId && (
        <p className="rounded-box bg-base-200 px-4 py-2 text-xs text-base-content/50">
          Checkout ID: {checkoutId}
        </p>
      )}
      <Link to="/orders" className="btn btn-primary gap-2">
        <PackageIcon className="size-4" aria-hidden />
        checkout orders
      </Link>
    </div>
  );
}
