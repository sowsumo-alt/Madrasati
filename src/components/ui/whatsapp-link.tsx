import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

interface WhatsAppLinkProps {
  phone: string;
  message: string;
  title: string;
  className?: string;
}

/**
 * Icône WhatsApp standard de l'application : mêmes dimensions, mêmes
 * couleurs et même retour tactile immédiat (léger enfoncement au clic/appui)
 * partout où un message peut être envoyé. On ne peut pas savoir si le
 * message part réellement (WhatsApp est une appli externe) : la seule
 * confirmation honnête est ce retour instantané au clic, pas une fausse
 * coche "envoyé".
 */
export function WhatsAppLink({ phone, message, title, className }: WhatsAppLinkProps) {
  return (
    <a
      href={buildWhatsAppUrl(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-all duration-150 active:scale-90 hover:bg-primary-50",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" />
    </a>
  );
}
