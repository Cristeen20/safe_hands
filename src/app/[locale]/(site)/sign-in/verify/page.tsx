import { VerifyForm } from "@/components/auth/verify-form";
import { container } from "@/components/site/container";
import { card } from "@/components/ui/styles";

export default function VerifyPage() {
  return (
    <main className={`${container} flex justify-center py-10 md:py-16`}>
      <div className={`${card} flex w-full max-w-md flex-col p-6 sm:p-8`}>
        <VerifyForm />
      </div>
    </main>
  );
}
