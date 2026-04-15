"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Container, Card, Form, Button, Row, Col } from "react-bootstrap";
import { toastError, toastSuccess } from "@/shared/utils/toast";

export default function CompanyProfilePage() {
  const [companyId, setCompanyId] = useState(null);
  const [profile, setProfile] = useState({
    name: "Premium Steel Buildings Inc",
    shortName: "PSB",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  async function loadProfile(options = {}) {
    const forceFresh = Boolean(options.forceFresh);

    try {
      const response = await fetch("/api/company/profile", {
        method: "GET",
        cache: forceFresh ? "no-store" : "default",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Unable to load company profile");
      }

      const data = payload?.profile || null;

      if (data) {
        setCompanyId(data.comp_id || null);
        setProfile({
          name: data.comp_name || "Premium Steel Buildings Inc",
          shortName: data.short_name || "PSB",
          email: data.comp_email || "",
          phone: data.comp_phone || "",
        });
      }
    } catch (error) {
      console.error("Failed to load company profile", error);
      toastError("Error loading profile.", "Company Profile");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const saveProfile = async () => {
    setSaving(true);

    try {
      const response = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          comp_id: companyId,
          name: profile.name,
          shortName: profile.shortName,
          email: profile.email,
          phone: profile.phone,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Unable to save company profile");
      }

      const nextProfile = payload?.profile || null;
      if (nextProfile) {
        setCompanyId(nextProfile.comp_id || null);
      }

      await loadProfile({ forceFresh: true });
      toastSuccess("Profile saved.", "Company Profile");
    } catch (error) {
      toastError("Error saving: " + (error?.message || "Unable to save profile"), "Company Profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container className="py-4" style={{ maxWidth: 700 }}>
      <div className="d-flex align-items-center mb-3">
        <Link href="/" className="back-link me-3">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Back
        </Link>
        <div>
          <h2 className="mb-0">Company Profile</h2>
          <p className="text-muted mb-0">
            Update company contact details used across the app
          </p>
        </div>
      </div>

      <Card>
        <Card.Body>
          <Row className="g-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Company Name</Form.Label>
                <Form.Control
                  value={profile.name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Short Name</Form.Label>
                <Form.Control
                  value={profile.shortName}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, shortName: e.target.value }))
                  }
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Email</Form.Label>
                <Form.Control
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </Form.Group>
            </Col>
          </Row>
          <div className="d-flex gap-2 mt-3">
            <Button variant="success" onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => loadProfile({ forceFresh: true })}
            >
              Reset
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Card className="mt-3">
        <Card.Header className="fw-bold">Preview</Card.Header>
        <Card.Body>
          <p className="mb-1">
            <strong>Company:</strong> {profile.name}
          </p>
          <p className="mb-1">
            <strong>Short Name:</strong> {profile.shortName}
          </p>
          <p className="mb-1">
            <strong>Email:</strong> {profile.email}
          </p>
          <p className="mb-0">
            <strong>Phone:</strong> {profile.phone}
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}

