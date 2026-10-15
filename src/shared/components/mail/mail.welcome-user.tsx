import { Body, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components";
import { siteConfig } from "@/shared/config/site";
import { emailContent, emailStyles } from "./email.styles";

interface WelcomeEmailProps {
  name: string;
}

export const WelcomeEmail = ({ name }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to {siteConfig.name}!</Preview>
    <Body style={emailStyles.body}>
      <Container style={emailStyles.container}>
        <Section>
          <Text style={emailStyles.heading}>Welcome to {siteConfig.name}!</Text>
          <Text style={emailStyles.text}>{emailContent.greeting(name)}</Text>
          <Text style={emailStyles.text}>
            Thank you for joining {siteConfig.name}! {siteConfig.tagline}
          </Text>
          <Text style={emailStyles.text}>{siteConfig.description}</Text>
          <Text style={emailStyles.text}>{emailContent.signOff()}</Text>
        </Section>

        <Section style={emailStyles.footer}>
          <Text style={emailStyles.mutedText}>{siteConfig.email.footer.company}</Text>
          <Text style={emailStyles.mutedText}>
            {siteConfig.contact.address.line1}, {siteConfig.contact.address.city}, {siteConfig.contact.address.state}{" "}
            {siteConfig.contact.address.postalCode}
          </Text>
          <Text style={emailStyles.mutedText}>
            <Link href={siteConfig.urls.privacy} style={emailStyles.footerLink}>
              {siteConfig.email.footer.privacy}
            </Link>
            {" • "}
            <Link href={siteConfig.urls.terms} style={emailStyles.footerLink}>
              {siteConfig.email.footer.terms}
            </Link>
          </Text>
          <Text style={emailStyles.mutedText}>{emailContent.supportInfo()}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
);
