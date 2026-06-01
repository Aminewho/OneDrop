import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isDeleting?: boolean;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete track?",
  description = "Are you sure you want to delete this track? This action cannot be undone.",
  isDeleting = false,
}: DeleteConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-[#121214] border border-white/10 text-white rounded-2xl shadow-2xl p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold text-white">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-400 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="mt-6 flex flex-row justify-end gap-3 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={isDeleting}
            className="text-gray-400 hover:text-white hover:bg-white/5 rounded-xl px-4 py-2"
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm} 
            disabled={isDeleting}
            className="bg-red-500/90 hover:bg-red-500 text-white rounded-xl px-4 py-2 transition-colors duration-150 font-medium"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}