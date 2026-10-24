import { WhenStep } from "@/components/booking/booking-form";
import { container } from "@/components/site/container";

export default function BookWhenPage() {
  return (
    <main className={`${container} py-6 md:py-10`}>
      <WhenStep />
    </main>
  );
}
