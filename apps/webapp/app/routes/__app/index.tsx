import {
  ArrowLeftOnRectangleIcon,
  BuildingOffice2Icon,
  PlusIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { Link } from "@remix-run/react";
import classNames from "classnames";
import { AppBody } from "~/components/layout/AppLayout";
import { Header } from "~/components/layout/Header";
import { MenuTitleToolTip } from "~/components/primitives/MenuTitleToolTip";
import { Body } from "~/components/primitives/text/Body";
import { Header4 } from "~/components/primitives/text/Headers";
import type { MatchedOrganization } from "~/hooks/useOrganizations";
import { useOrganizations } from "~/hooks/useOrganizations";
import { useOptionalUser } from "~/hooks/useUser";
import banner from "../../assets/images/org-banner.png";

export default function AppLayout() {
  const organizations = useOrganizations();
  const user = useOptionalUser();

  return (
    <>
      <AppBody>
        <Header context="workflows" />
        <div className="w-full overflow-auto">
          <div className="mt-28 flex flex-col items-center justify-center">
            <div className="fixed top-[3.6rem] h-80 w-full overflow-hidden bg-slate-900/50">
              <img
                src={banner}
                alt="Organization banner"
                className="h-full w-full object-cover opacity-30"
              />
            </div>
            <h1 className="z-10 mb-20 text-4xl text-slate-400">
              Your Organizations
            </h1>
            <div className="z-10 mb-12 flex items-center justify-center">
              <ul className="grid max-w-7xl grid-cols-2 gap-2 lg:grid-cols-3">
                {organizations ? (
                  <OrganizationGrid organizations={organizations} />
                ) : (
                  <li>
                    <Body>No organizations</Body>
                  </li>
                )}
                <li>
                  <Link
                    to="orgs/new"
                    className={classNames(
                      "h-full border border-slate-700 hover:border-transparent hover:bg-[rgb(38,51,71)] hover:shadow-md",
                      boxClasses
                    )}
                  >
                    <PlusIcon className="h-10 w-10 text-green-500" />
                    <Header4 size="small" className="mb-10">
                      New Organization
                    </Header4>
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="absolute bottom-0 left-2">
            <MenuTitleToolTip
              text={
                user
                  ? `Logout ${user.displayName ? user.displayName : user.email}`
                  : "Logout"
              }
            >
              <a
                href={`/logout`}
                className="mb-2 rounded p-2 transition hover:bg-slate-600/50"
              >
                <ArrowLeftOnRectangleIcon className="h-6 w-6 text-slate-300" />
              </a>
            </MenuTitleToolTip>
          </div>
        </div>
      </AppBody>
    </>
  );
}

function OrganizationGrid({
  organizations,
}: {
  organizations: MatchedOrganization[];
}) {
  return (
    <>
      {organizations.map((organization) => (
        <OrganizationGridItem
          key={organization.id}
          organization={organization}
        />
      ))}
    </>
  );
}

function OrganizationGridItem({
  organization,
}: {
  organization: MatchedOrganization;
}) {
  return (
    <li key={organization.id} className="h-full w-full">
      <Link
        to={`orgs/${organization.slug}`}
        className={classNames(
          "border border-slate-700 bg-slate-800 hover:bg-[rgb(38,51,71)]",
          boxClasses
        )}
      >
        {organization.title === "Personal Workspace" ? (
          <UserIcon className="h-10 w-10 text-slate-300" aria-hidden="true" />
        ) : (
          <BuildingOffice2Icon
            className="h-10 w-10 text-blue-500"
            aria-hidden="true"
          />
        )}
        <Header4 size="large" className="mb-16 text-slate-300">
          {organization.title}
        </Header4>
      </Link>
    </li>
  );
}

const boxClasses =
  "flex flex-col gap-4 w-80 text-center shadow-md items-center justify-center rounded-lg px-2 pb-2 pt-16 min-h-full transition";
