import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EnhancedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  isLoading?: boolean;
  showPasswordToggle?: boolean;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    validator?: (value: string) => string | null;
  };
}

const EnhancedInput = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({ 
    className, 
    type, 
    label, 
    error, 
    success, 
    isLoading, 
    showPasswordToggle,
    validation,
    onChange,
    ...props 
  }, ref) => {
    const [internalValue, setInternalValue] = React.useState(props.value || "");
    const [isFocused, setIsFocused] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [validationState, setValidationState] = React.useState<{
      isValid: boolean;
      message: string | null;
    }>({ isValid: true, message: null });

    const inputType = showPasswordToggle ? (showPassword ? "text" : "password") : type;

    const validateInput = (value: string) => {
      if (!validation) return { isValid: true, message: null };

      if (validation.required && !value.trim()) {
        return { isValid: false, message: "Ce champ est requis" };
      }

      if (validation.minLength && value.length < validation.minLength) {
        return { isValid: false, message: `Minimum ${validation.minLength} caractères` };
      }

      if (validation.maxLength && value.length > validation.maxLength) {
        return { isValid: false, message: `Maximum ${validation.maxLength} caractères` };
      }

      if (validation.pattern && !validation.pattern.test(value)) {
        return { isValid: false, message: "Format invalide" };
      }

      if (validation.validator) {
        const customError = validation.validator(value);
        if (customError) {
          return { isValid: false, message: customError };
        }
      }

      return { isValid: true, message: null };
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInternalValue(value);
      
      // Validation en temps réel avec debounce
      const validation = validateInput(value);
      setValidationState(validation);
      
      if (onChange) {
        onChange(e);
      }
    };

    const hasError = error || !validationState.isValid;
    const hasSuccess = success || (validationState.isValid && internalValue.trim() && validation);

    return (
      <div className="relative space-y-2">
        {label && (
          <motion.label
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "block text-sm font-medium transition-colors duration-200",
              hasError ? "text-red-600" : hasSuccess ? "text-green-600" : "text-gray-700"
            )}
          >
            {label}
            {validation?.required && <span className="text-red-500 ml-1">*</span>}
          </motion.label>
        )}
        
        <div className="relative">
          <motion.div
            animate={{
              scale: isFocused ? 1.02 : 1,
              borderColor: hasError 
                ? "#ef4444" 
                : hasSuccess 
                  ? "#10b981" 
                  : isFocused 
                    ? "#3b82f6" 
                    : "#d1d5db"
            }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <input
              type={inputType}
              className={cn(
                "flex h-12 w-full rounded-xl border-2 bg-white px-4 py-3 text-sm transition-all duration-200",
                "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "hover:shadow-sm",
                hasError && "border-red-500 bg-red-50/50",
                hasSuccess && "border-green-500 bg-green-50/50",
                !hasError && !hasSuccess && "border-gray-300 focus:border-blue-500 focus:bg-blue-50/30",
                showPasswordToggle && "pr-12",
                className
              )}
              ref={ref}
              value={internalValue}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              {...props}
            />
            
            {/* Status Icons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              {isLoading && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"
                />
              )}
              
              {!isLoading && hasSuccess && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </motion.div>
              )}
              
              {!isLoading && hasError && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </motion.div>
              )}
              
              {showPasswordToggle && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
        
        {/* Error/Success Messages */}
        {/* ✅ CORRIGÉ : AnimatePresence avec mode="wait" - un seul enfant conditionnel */}
        <AnimatePresence mode="wait" initial={false}>
          {(error || validationState.message || success) && (
            <motion.div
              key={error || validationState.message || success || 'message'}
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "text-sm font-medium",
                hasError ? "text-red-600" : "text-green-600"
              )}
            >
              {error || validationState.message || success}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

EnhancedInput.displayName = "EnhancedInput";

export { EnhancedInput };
