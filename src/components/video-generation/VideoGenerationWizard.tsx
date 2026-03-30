import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { VideoStepIndicator } from './VideoStepIndicator';
import { PresetSelector } from './PresetSelector';
import { ShootAndImageSelector } from './ShootAndImageSelector';
import { ConfigureAndGenerate } from './ConfigureAndGenerate';
import { ProcessingView } from './ProcessingView';
import { useSubmitVideo } from '@/hooks/useVideoGeneration';
import type { VideoPreset } from '@/services/higgsFieldService';

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -200 : 200, opacity: 0 }),
};

export function VideoGenerationWizard() {
  const { toast } = useToast();
  const submitVideo = useSubmitVideo();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [submittedJobId, setSubmittedJobId] = useState<number | null>(null);

  // Wizard state
  const [selectedPreset, setSelectedPreset] = useState<VideoPreset | null>(null);
  const [selectedShootId, setSelectedShootId] = useState<number | null>(null);
  const [shootAddress, setShootAddress] = useState('');
  const [startFrameId, setStartFrameId] = useState<number | null>(null);
  const [endFrameId, setEndFrameId] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'horizontal' | 'vertical' | 'square' | 'standard'>('horizontal');

  const getRequestAspectRatio = (value: typeof aspectRatio): 'horizontal' | 'vertical' =>
    value === 'vertical' ? 'vertical' : 'horizontal';

  const getSubmitErrorMessage = (error: unknown) => {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = error.response;
      if (response && typeof response === 'object' && 'data' in response) {
        const data = response.data;
        if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
          return data.message;
        }
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'An error occurred';
  };

  const canGoNext = () => {
    switch (step) {
      case 1:
        return !!selectedPreset;
      case 2:
        return !!selectedShootId && !!startFrameId;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (!canGoNext()) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, 3));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleGenerate = async () => {
    if (!selectedPreset || !selectedShootId || !startFrameId) return;

    try {
      const job = await submitVideo.mutateAsync({
        shoot_id: selectedShootId,
        start_frame_file_id: startFrameId,
        end_frame_file_id: endFrameId || undefined,
        preset_id: selectedPreset.id,
        aspect_ratio: getRequestAspectRatio(aspectRatio),
      });

      setSubmittedJobId(job.id);
      toast({
        title: 'Video generation started',
        description: aspectRatio === 'vertical'
          ? 'Converting images to vertical format...'
          : 'Your video is being generated...',
      });
    } catch (error: unknown) {
      toast({
        title: 'Failed to submit',
        description: getSubmitErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const handleCreateAnother = () => {
    setSubmittedJobId(null);
    setStep(1);
    setSelectedPreset(null);
    setSelectedShootId(null);
    setShootAddress('');
    setStartFrameId(null);
    setEndFrameId(null);
    setAspectRatio('horizontal');
  };

  // If a job is submitted, show processing view
  if (submittedJobId) {
    return <ProcessingView jobId={submittedJobId} onCreateAnother={handleCreateAnother} />;
  }

  return (
    <div className="space-y-6">
      <VideoStepIndicator currentStep={step} />

      <AnimatePresence custom={direction} mode="wait">
        <motion.div
          key={step}
          custom={direction}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {step === 1 && (
            <PresetSelector selectedPreset={selectedPreset} onSelect={setSelectedPreset} />
          )}

          {step === 2 && selectedPreset && (
            <ShootAndImageSelector
              preset={selectedPreset}
              selectedShootId={selectedShootId}
              startFrameId={startFrameId}
              endFrameId={endFrameId}
              onShootSelect={(id) => {
                setSelectedShootId(id);
                setStartFrameId(null);
                setEndFrameId(null);
              }}
              onStartFrameSelect={setStartFrameId}
              onEndFrameSelect={setEndFrameId}
            />
          )}

          {step === 3 && selectedPreset && (
            <ConfigureAndGenerate
              preset={selectedPreset}
              shootAddress={shootAddress || `Shoot #${selectedShootId}`}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              onGenerate={handleGenerate}
              isSubmitting={submitVideo.isPending}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      {step < 3 && (
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={goBack} disabled={step === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button onClick={goNext} disabled={!canGoNext()}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={goBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
