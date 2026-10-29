"use client";

import { Minus, Plus } from "lucide-react";
import { z } from "zod/v3";
import { FormItem } from "@/shared/components/common/form";
import { Button } from "@/shared/components/ui/button";
import { debugLog } from "@/shared/utils/lib/logger.utils";
import Form from "../form";

export const signinValidation = z.object({
  items: z
    .array(
      z
        .object({
          email: z
            .string()
            .min(1, "Email is required")
            .email("Invalid email format")
            .trim()
            .toLowerCase()
            .refine((email) => !email.includes(" "), "Email cannot contain spaces"),
          password: z
            .string()
            .min(1, "Password is required")
            .min(8, "Password must be at least 8 characters")
            .max(100, "Password cannot exceed 100 characters")
            .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
            .regex(/[a-z]/, "Password must contain at least one lowercase letter")
            .regex(/[0-9]/, "Password must contain at least one number")
            .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
            .refine((password) => !password.includes(" "), "Password cannot contain spaces"),
          confirmPassword: z.string().min(1, "Please confirm your password"),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords don't match",
          path: ["confirmPassword"],
        }),
    )
    .min(1, "At least one item is required"),
});

export type SignInValidation = z.infer<typeof signinValidation>;

export default function FormDemo() {
  const defaultArrayValue = {
    email: "",
    password: "",
    confirmPassword: "",
  };
  const defaultValues = {
    items: [defaultArrayValue],
  } satisfies SignInValidation;

  const onSubmit = (data: SignInValidation) => {
    debugLog("Submitted data:", data);
  };
  return (
    <Form
      schema={signinValidation}
      defaultValues={defaultValues}
      onSubmitAction={onSubmit}
      className="grid w-full grid-cols-1 gap-4"
    >
      <Form.FormGroup name="items">
        {({ index, add, remove }) => (
          <FormItem key={index} className="bg-card rounded-xl p-4">
            <Form.Field
              key={`items.${index}.email`}
              {...{
                name: `items.${index}.email`,
                label: "Email",
                type: "text",
                placeholder: "Enter your email",
              }}
            />
            <Form.Field
              key={`items.${index}.password`}
              {...{
                name: `items.${index}.password`,
                label: "Password",
                type: "password",
                placeholder: "Enter your password",
                fieldProps: {
                  type: "password",
                },
              }}
            />
            <Form.FormWatch key={`items.${index}.confirmPassword`} name={`items.${index}.password`}>
              {({ value }) => (
                <Form.Field
                  key={`items.${index}.confirmPassword`}
                  {...{
                    hidden: value.length < 1,
                    name: `items.${index}.confirmPassword`,
                    label: "Confirm Password",
                    type: "password",
                    placeholder: "Confirm your password",
                  }}
                />
              )}
            </Form.FormWatch>
            <div className="flex gap-2">
              <Button key={`items.${index}.add`} type="button" size={"icon"} onClick={() => add(defaultArrayValue)}>
                <Plus />
              </Button>
              <Button
                key={`items.${index}.remove`}
                disabled={index === 0}
                type="button"
                size={"icon"}
                onClick={() => remove(index)}
              >
                <Minus />
              </Button>
            </div>
          </FormItem>
        )}
      </Form.FormGroup>
      <Form.Submit isLoading={false} />
    </Form>
  );
}
