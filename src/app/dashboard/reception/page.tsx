import { redirect } from "next/navigation";

export default function ReceptionIndexPage() {
  redirect("/dashboard/reception/checkin");
}