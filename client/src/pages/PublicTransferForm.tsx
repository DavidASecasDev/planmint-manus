 import { useState, useEffect } from "react";
 import { useParams } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { FormWithFields, FormFieldType } from "@/types/forms";
 import { usePublicFormSubmit } from "@/hooks/useForms";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Label } from "@/components/ui/label";
 import { Checkbox } from "@/components/ui/checkbox";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { CheckCircle, FileWarning, Loader2, Anchor } from "lucide-react";
 
 // Nautical Luxury color palette (consistent with PDF documents)
 const COLORS = {
   navy: '#1a365d',
   navyLight: '#2c5282',
   slate: '#334155',
   coolGray: '#64748b',
   gold: '#b8860b',
   bgLight: '#f8fafc',
   white: '#ffffff',
 };
 
 export default function PublicTransferForm() {
   const { slug } = useParams<{ slug: string }>();
   const { submit, isSubmitting } = usePublicFormSubmit();
 
   const [form, setForm] = useState<FormWithFields | null>(null);
   const [orgLogo, setOrgLogo] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [submitted, setSubmitted] = useState(false);
   const [formData, setFormData] = useState<Record<string, unknown>>({});
   const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
 
   useEffect(() => {
     const fetchForm = async () => {
       if (!slug) return;
 
       try {
         const { data: formData, error: formError } = await (supabase as any)
           .from('forms')
           .select('*')
           .eq('slug', slug)
           .eq('is_active', true)
           .eq('is_public', true)
           .maybeSingle();
 
         if (formError) throw formError;
         if (!formData) {
           setError('Formulario no encontrado o no disponible');
           setLoading(false);
           return;
         }
 
         // Check expiration
         if (formData.expires_at && new Date(formData.expires_at) < new Date()) {
           setError('Este formulario ha expirado');
           setLoading(false);
           return;
         }
 
         // Check max responses
         if (formData.max_responses && formData.response_count >= formData.max_responses) {
           setError('Este formulario ya no acepta más respuestas');
           setLoading(false);
           return;
         }
 
         // Fetch organization logo
         const { data: orgData } = await supabase
           .from('organizations')
           .select('logo_url')
           .eq('id', formData.organization_id)
           .single();
         
         if (orgData?.logo_url) {
           setOrgLogo(orgData.logo_url);
         }
 
         // Fetch fields
         const { data: fieldsData, error: fieldsError } = await (supabase as any)
           .from('form_fields')
           .select('*')
           .eq('form_id', formData.id)
           .order('position');
 
         if (fieldsError) throw fieldsError;
 
         setForm({ ...formData, fields: fieldsData || [] });
       } catch (err) {
         console.error('Error fetching form:', err);
         setError('Error al cargar el formulario');
       } finally {
         setLoading(false);
       }
     };
 
     fetchForm();
   }, [slug]);
 
   const handleChange = (fieldName: string, value: unknown) => {
     setFormData(prev => ({ ...prev, [fieldName]: value }));
     if (validationErrors[fieldName]) {
       setValidationErrors(prev => {
         const { [fieldName]: _, ...rest } = prev;
         return rest;
       });
     }
   };
 
   const validate = (): boolean => {
     const errors: Record<string, string> = {};
 
     form?.fields.forEach(field => {
       const value = formData[field.name];
       
       if (field.is_required && (value === undefined || value === '' || value === null)) {
         errors[field.name] = 'Este campo es obligatorio';
       }
 
       if (field.type === 'email' && value && typeof value === 'string') {
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
         if (!emailRegex.test(value)) {
           errors[field.name] = 'Email inválido';
         }
       }
 
       if (field.min_length && typeof value === 'string' && value.length < field.min_length) {
         errors[field.name] = `Mínimo ${field.min_length} caracteres`;
       }
 
       if (field.max_length && typeof value === 'string' && value.length > field.max_length) {
         errors[field.name] = `Máximo ${field.max_length} caracteres`;
       }
     });
 
     setValidationErrors(errors);
     return Object.keys(errors).length === 0;
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
 
     if (!form || !validate()) return;
 
     try {
       await submit({
         form_id: form.id,
         data: formData,
         submitter_email: formData.submitter_email as string | undefined,
         submitter_name: formData.broker_name as string | undefined,
       });
 
       setSubmitted(true);
 
       if (form.redirect_url) {
         setTimeout(() => {
           window.location.href = form.redirect_url!;
         }, 2000);
       }
     } catch (err) {
       console.error('Error submitting form:', err);
     }
   };
 
   // Group fields by section based on their mapping
   const groupFieldsBySection = (fields: FormWithFields['fields']) => {
     const contactFields: typeof fields = [];
     const serviceFields: typeof fields = [];
     const additionalFields: typeof fields = [];
 
     fields.forEach(field => {
       const mapping = field.maps_to_transfer_field;
       if (['broker_name', 'client_name'].includes(mapping || '') || 
           ['email', 'phone'].includes(field.type) ||
           field.name.includes('email') || field.name.includes('phone') || field.name.includes('broker')) {
         contactFields.push(field);
       } else if (['transfer_date', 'pickup_time', 'pickup_location', 'dropoff_location', 'pax_count'].includes(mapping || '') ||
                  field.name.includes('date') || field.name.includes('pickup') || field.name.includes('dropoff') ||
                  field.name.includes('pax') || field.name.includes('vehicle')) {
         serviceFields.push(field);
       } else {
         additionalFields.push(field);
       }
     });
 
     return { contactFields, serviceFields, additionalFields };
   };
 
   const renderField = (field: FormWithFields['fields'][0]) => {
     const value = formData[field.name];
     const error = validationErrors[field.name];
 
     const inputStyles = `
       w-full px-4 py-3 rounded-lg border transition-all duration-200
       focus:outline-none focus:ring-2 focus:ring-opacity-50
       ${error 
         ? 'border-red-400 focus:ring-red-300 bg-red-50' 
         : 'border-gray-200 focus:ring-[#1a365d] focus:border-[#1a365d] bg-white'
       }
     `;
 
     switch (field.type as FormFieldType) {
       case 'text':
       case 'email':
       case 'phone':
         return (
           <input
             type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
             id={field.name}
             placeholder={field.placeholder || undefined}
             className={inputStyles}
             value={(value as string) || ''}
             onChange={(e) => handleChange(field.name, e.target.value)}
           />
         );
 
       case 'number':
         return (
           <input
             type="number"
             id={field.name}
             placeholder={field.placeholder || undefined}
             className={inputStyles}
             value={(value as number) || ''}
             onChange={(e) => handleChange(field.name, e.target.valueAsNumber || '')}
             min={field.min_value || undefined}
             max={field.max_value || undefined}
           />
         );
 
       case 'textarea':
         return (
           <textarea
             id={field.name}
             placeholder={field.placeholder || undefined}
             className={`${inputStyles} min-h-[120px] resize-none`}
             value={(value as string) || ''}
             onChange={(e) => handleChange(field.name, e.target.value)}
             rows={4}
           />
         );
 
       case 'date':
         return (
           <input
             type="date"
             id={field.name}
             className={inputStyles}
             value={(value as string) || ''}
             onChange={(e) => handleChange(field.name, e.target.value)}
           />
         );
 
       case 'datetime':
         return (
           <input
             type="datetime-local"
             id={field.name}
             className={inputStyles}
             value={(value as string) || ''}
             onChange={(e) => handleChange(field.name, e.target.value)}
           />
         );
 
       case 'select':
         return (
           <select
             id={field.name}
             className={inputStyles}
             value={(value as string) || ''}
             onChange={(e) => handleChange(field.name, e.target.value)}
           >
             <option value="">{field.placeholder || 'Seleccionar...'}</option>
             {field.options?.map((option) => (
               <option key={option.value} value={option.value}>
                 {option.label}
               </option>
             ))}
           </select>
         );
 
       case 'checkbox':
         return (
           <label className="flex items-center gap-3 cursor-pointer group">
             <div className={`
               w-5 h-5 rounded border-2 flex items-center justify-center transition-all
               ${(value as boolean) 
                 ? 'bg-[#1a365d] border-[#1a365d]' 
                 : 'border-gray-300 group-hover:border-[#1a365d]'
               }
             `}>
               {(value as boolean) && (
                 <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                 </svg>
               )}
             </div>
             <input
               type="checkbox"
               className="sr-only"
               checked={(value as boolean) || false}
               onChange={(e) => handleChange(field.name, e.target.checked)}
             />
             <span className="text-[#334155]">{field.label}</span>
           </label>
         );
 
       default:
         return (
           <input
             type="text"
             id={field.name}
             placeholder={field.placeholder || undefined}
             className={inputStyles}
             value={(value as string) || ''}
             onChange={(e) => handleChange(field.name, e.target.value)}
           />
         );
     }
   };
 
   const SectionHeader = ({ title }: { title: string }) => (
     <div className="flex items-center gap-4 mb-6">
       <h2 className="text-lg font-semibold" style={{ color: COLORS.slate }}>
         {title}
       </h2>
       <div 
         className="flex-1 h-0.5"
         style={{ 
           background: `linear-gradient(to right, ${COLORS.gold}, transparent)` 
         }}
       />
     </div>
   );
 
   if (loading) {
     return (
       <div 
         className="min-h-screen flex items-center justify-center"
         style={{ backgroundColor: COLORS.bgLight }}
       >
         <div className="text-center">
           <Loader2 
             className="h-12 w-12 animate-spin mx-auto mb-4" 
             style={{ color: COLORS.navy }}
           />
           <p style={{ color: COLORS.coolGray }}>Cargando formulario...</p>
         </div>
       </div>
     );
   }
 
   if (error) {
     return (
       <div 
         className="min-h-screen flex items-center justify-center p-4"
         style={{ backgroundColor: COLORS.bgLight }}
       >
         <div 
           className="max-w-md w-full rounded-2xl shadow-xl p-12 text-center"
           style={{ backgroundColor: COLORS.white }}
         >
           <FileWarning 
             className="h-20 w-20 mx-auto mb-6" 
             style={{ color: COLORS.coolGray }}
           />
           <h1 
             className="text-2xl font-semibold mb-3"
             style={{ color: COLORS.slate }}
           >
             No disponible
           </h1>
           <p style={{ color: COLORS.coolGray }}>{error}</p>
         </div>
       </div>
     );
   }
 
   if (submitted) {
     return (
       <div 
         className="min-h-screen flex items-center justify-center p-4"
         style={{ backgroundColor: COLORS.bgLight }}
       >
         <div 
           className="max-w-md w-full rounded-2xl shadow-xl overflow-hidden"
           style={{ backgroundColor: COLORS.white }}
         >
           {/* Success header */}
           <div 
             className="py-8 px-6 text-center"
             style={{ 
               background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})` 
             }}
           >
             <div className="w-20 h-20 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-4">
               <CheckCircle className="h-12 w-12 text-white" />
             </div>
             <h1 className="text-2xl font-semibold text-white">
               ¡Solicitud Enviada!
             </h1>
           </div>
           {/* Success body */}
           <div className="p-8 text-center">
             <p className="text-lg mb-2" style={{ color: COLORS.slate }}>
               {form?.success_message || 'Gracias por tu solicitud.'}
             </p>
             <p style={{ color: COLORS.coolGray }}>
               Nos pondremos en contacto contigo pronto.
             </p>
             {form?.redirect_url && (
               <p className="text-sm mt-6" style={{ color: COLORS.coolGray }}>
                 <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                 Redirigiendo...
               </p>
             )}
           </div>
         </div>
       </div>
     );
   }
 
   const { contactFields, serviceFields, additionalFields } = groupFieldsBySection(form?.fields || []);
 
   return (
     <div 
       className="min-h-screen py-8 px-4"
       style={{ backgroundColor: COLORS.bgLight }}
     >
       <div className="max-w-2xl mx-auto">
         {/* Premium card container */}
         <div 
           className="rounded-2xl shadow-xl overflow-hidden"
           style={{ backgroundColor: COLORS.white }}
         >
           {/* Navy gradient header */}
           <div 
             className="py-8 px-8"
             style={{ 
               background: `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyLight})` 
             }}
           >
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                 {(orgLogo || form?.custom_logo_url) ? (
                   <img 
                     src={form?.custom_logo_url || orgLogo || ''} 
                     alt="Logo" 
                     className="h-12 object-contain bg-white/10 rounded-lg p-1"
                   />
                 ) : (
                   <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                     <Anchor className="h-6 w-6 text-white/80" />
                   </div>
                 )}
                 <div>
                   <h1 className="text-2xl font-semibold text-white tracking-wide uppercase">
                     {form?.name || 'Solicitud de Transfer'}
                   </h1>
                   <p className="text-white/70 text-sm">
                     {form?.description || 'Servicio premium de traslados'}
                   </p>
                 </div>
               </div>
             </div>
           </div>
 
           {/* Form content */}
           <form onSubmit={handleSubmit} className="p-8">
             {/* Contact Information Section */}
             {contactFields.length > 0 && (
               <div className="mb-8">
                 <SectionHeader title="Información de Contacto" />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {contactFields.map((field) => (
                     <div 
                       key={field.id} 
                       className={`space-y-2 ${field.width === 'full' ? 'md:col-span-2' : ''}`}
                     >
                       {field.type !== 'checkbox' && (
                         <label 
                           htmlFor={field.name}
                           className="block text-sm font-medium"
                           style={{ color: COLORS.slate }}
                         >
                           {field.label}
                           {field.is_required && (
                             <span className="text-red-500 ml-1">*</span>
                           )}
                         </label>
                       )}
                       {renderField(field)}
                       {field.help_text && (
                         <p className="text-xs" style={{ color: COLORS.coolGray }}>
                           {field.help_text}
                         </p>
                       )}
                       {validationErrors[field.name] && (
                         <p className="text-xs text-red-500">
                           {validationErrors[field.name]}
                         </p>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             )}
 
             {/* Service Details Section */}
             {serviceFields.length > 0 && (
               <div className="mb-8">
                 <SectionHeader title="Detalles del Servicio" />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {serviceFields.map((field) => (
                     <div 
                       key={field.id} 
                       className={`space-y-2 ${field.width === 'full' ? 'md:col-span-2' : ''}`}
                     >
                       {field.type !== 'checkbox' && (
                         <label 
                           htmlFor={field.name}
                           className="block text-sm font-medium"
                           style={{ color: COLORS.slate }}
                         >
                           {field.label}
                           {field.is_required && (
                             <span className="text-red-500 ml-1">*</span>
                           )}
                         </label>
                       )}
                       {renderField(field)}
                       {field.help_text && (
                         <p className="text-xs" style={{ color: COLORS.coolGray }}>
                           {field.help_text}
                         </p>
                       )}
                       {validationErrors[field.name] && (
                         <p className="text-xs text-red-500">
                           {validationErrors[field.name]}
                         </p>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             )}
 
             {/* Additional Information Section */}
             {additionalFields.length > 0 && (
               <div className="mb-8">
                 <SectionHeader title="Información Adicional" />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {additionalFields.map((field) => (
                     <div 
                       key={field.id} 
                       className={`space-y-2 ${field.width === 'full' ? 'md:col-span-2' : ''}`}
                     >
                       {field.type !== 'checkbox' && (
                         <label 
                           htmlFor={field.name}
                           className="block text-sm font-medium"
                           style={{ color: COLORS.slate }}
                         >
                           {field.label}
                           {field.is_required && (
                             <span className="text-red-500 ml-1">*</span>
                           )}
                         </label>
                       )}
                       {renderField(field)}
                       {field.help_text && (
                         <p className="text-xs" style={{ color: COLORS.coolGray }}>
                           {field.help_text}
                         </p>
                       )}
                       {validationErrors[field.name] && (
                         <p className="text-xs text-red-500">
                           {validationErrors[field.name]}
                         </p>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             )}
 
             {/* Submit button */}
             <button
               type="submit"
               disabled={isSubmitting}
               className="w-full py-4 px-6 rounded-lg text-white font-semibold text-lg tracking-wide uppercase transition-all duration-200 disabled:opacity-60"
               style={{ 
                 backgroundColor: COLORS.navy,
               }}
               onMouseOver={(e) => e.currentTarget.style.backgroundColor = COLORS.navyLight}
               onMouseOut={(e) => e.currentTarget.style.backgroundColor = COLORS.navy}
             >
               {isSubmitting ? (
                 <span className="flex items-center justify-center gap-2">
                   <Loader2 className="h-5 w-5 animate-spin" />
                   Enviando solicitud...
                 </span>
               ) : (
                 'Enviar Solicitud'
               )}
             </button>
           </form>
         </div>
 
         {/* Footer */}
         <p 
           className="text-center text-sm mt-6"
           style={{ color: COLORS.coolGray }}
         >
           Powered by{' '}
           <span style={{ color: COLORS.navy }} className="font-medium">
             Planmint
           </span>
         </p>
       </div>
     </div>
   );
 }