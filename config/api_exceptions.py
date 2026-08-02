from rest_framework import status
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, dict):
        if 'detail' in data and len(data) == 1:
            response.data = {'detail': data['detail'], 'errors': {}}
        else:
            detail = data.pop('detail', None)
            non_field = data.pop('non_field_errors', None)
            if detail is None and non_field is not None:
                detail = non_field
            if isinstance(detail, list):
                detail = detail[0] if detail else 'خطا در اعتبارسنجی.'
            response.data = {
                'detail': detail or 'خطا در اعتبارسنجی.',
                'errors': data,
            }
    elif isinstance(data, list):
        response.data = {
            'detail': data[0] if data else 'خطا.',
            'errors': {},
        }

    request = context.get('request')
    if (
        response.status_code == status.HTTP_403_FORBIDDEN
        and request is not None
        and not request.user.is_authenticated
    ):
        response.status_code = status.HTTP_401_UNAUTHORIZED

    return response
