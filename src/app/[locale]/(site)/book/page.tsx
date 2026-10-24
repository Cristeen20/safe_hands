import { DetailsStep } from "@/components/booking/booking-form";
import { container } from "@/components/site/container";

export default function BookPage() {
  return (
    <main className={`${container} py-6 md:py-10`}>
      <DetailsStep />
    </main>
  );
}
