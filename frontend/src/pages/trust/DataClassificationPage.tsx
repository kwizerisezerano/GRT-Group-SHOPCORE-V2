import DataClassificationMatrix from "@/components/public-experience/DataClassificationMatrix";
import { PublicExperienceLayout } from "@/components/public-experience/PublicExperienceLayout";

export default function DataClassificationPage() {
  return (
    <PublicExperienceLayout
      center="trust"
      eyebrow="Data Classification"
      title="Business information is classified by sensitivity, access level, and operational purpose."
      description="Classification policies help organizations understand data categories, access requirements, retention obligations, and handling procedures across their ShopCore workspace."
    >
      <DataClassificationMatrix tone="trust" />
    </PublicExperienceLayout>
  );
}
