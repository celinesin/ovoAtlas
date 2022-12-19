from dataclasses import asdict

from flask import Response, jsonify, make_response

from backend.common.corpora_orm import ProjectLinkType
from backend.common.utils.http_exceptions import (
    InvalidParametersHTTPException,
    MethodNotAllowedException,
)
from backend.layers.api.router import get_business_logic
from backend.layers.auth.user_info import UserInfo
from backend.layers.business.entities import CollectionMetadataUpdate
from backend.layers.business.exceptions import CollectionUpdateException
from backend.layers.common import doi
from backend.layers.common.entities import Link
from backend.portal.api.curation.v1.curation.collections.common import (
    extract_doi_from_links,
    get_infered_collection_version_else_forbidden,
    is_owner_or_allowed_else_forbidden,
    reshape_for_curation_api,
)


def delete(collection_id: str, token_info: dict) -> Response:
    user_info = UserInfo(token_info)
    collection_version = get_infered_collection_version_else_forbidden(collection_id)
    is_owner_or_allowed_else_forbidden(collection_version, user_info)
    if collection_version.published_at:
        raise MethodNotAllowedException(detail="Cannot delete a published collection through API.")
    else:
        get_business_logic().delete_collection_version(collection_version.version_id)
    return make_response("", 204)


def get(collection_id: str, token_info: dict) -> Response:
    collection_version = get_infered_collection_version_else_forbidden(collection_id)
    user_info = UserInfo(token_info)
    response = reshape_for_curation_api(collection_version, user_info)
    return jsonify(response)


def patch(collection_id: str, body: dict, token_info: dict) -> Response:
    user_info = UserInfo(token_info)
    collection_version = get_infered_collection_version_else_forbidden(collection_id)
    is_owner_or_allowed_else_forbidden(collection_version, user_info)
    if collection_version.published_at:
        raise MethodNotAllowedException(
            detail="Directly editing a public Collection is not allowed; you must create a revision."
        )

    # Build CollectionMetadataUpdate object
    body["links"] = [Link(link.get("link_name"), link["link_type"], link["link_url"]) for link in body.get("links", [])]
    collection_metadata = CollectionMetadataUpdate(**body)

    # Update the collection
    errors = []
    if doi_url := body.get("doi"):
        if doi_url := doi.curation_get_normalized_doi_url(doi_url, errors):
            links = body.get("links", [])
            links.append({"link_type": ProjectLinkType.DOI.name, "link_url": doi_url})
            body["links"] = links
    try:
        get_business_logic().update_collection_version(collection_version.version_id, collection_metadata)
    except CollectionUpdateException as ex:
        errors.extend(ex.errors)
    if errors:
        raise InvalidParametersHTTPException(ext=dict(invalid_parameters=errors))

    # Make Response
    updated_collection_version = get_business_logic().get_collection_version(collection_version.version_id)

    metadata = asdict(updated_collection_version.metadata)
    metadata.pop("links")

    doi_url, links = extract_doi_from_links(updated_collection_version.metadata.links)

    response = dict(
        **metadata, publisher_metadata=updated_collection_version.publisher_metadata, links=links, doi=doi_url
    )
    return jsonify(response)
