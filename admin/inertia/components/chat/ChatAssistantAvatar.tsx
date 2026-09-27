import { IconWand } from "@tabler/icons-react";
import { usePage } from "@inertiajs/react";
import { assistantAvatarAltText } from "../../../app/utils/assistant_avatar";

export default function ChatAssistantAvatar() {
  const { aiAssistantName, aiAssistantAvatarUrl } = usePage<{
    aiAssistantName: string;
    aiAssistantAvatarUrl: string;
  }>().props;

  return (
    <div className="flex-shrink-0">
      <div className="h-8 w-8 rounded-full bg-desert-green flex items-center justify-center overflow-hidden">
        {aiAssistantAvatarUrl ? (
          <img
            src={aiAssistantAvatarUrl}
            alt={assistantAvatarAltText(aiAssistantName)}
            className="h-full w-full object-cover"
          />
        ) : (
          <IconWand className="h-5 w-5 text-white" />
        )}
      </div>
    </div>
  );
}
