import { BookingForm } from "@/components/booking/booking-form";
import { container } from "@/components/site/container";

export default function BookPage() {
  return (
    <main className={`${container} flex flex-col gap-6 py-8 md:py-12`}>
      <BookingForm />
    </main>
  );
}
