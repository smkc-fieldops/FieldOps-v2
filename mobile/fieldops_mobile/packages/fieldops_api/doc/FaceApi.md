# fieldops_api.api.FaceApi

## Load the API package
```dart
import 'package:fieldops_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**faceControllerCaptureOptions**](FaceApi.md#facecontrollercaptureoptions) | **GET** /api/v1/face/capture-options | Which face capture flow the app should run (local or Aadhaar FaceRD)
[**faceControllerClearEnrolments**](FaceApi.md#facecontrollerclearenrolments) | **DELETE** /api/v1/face/enrolments/{staffId} | Remove all of a person&#39;s enrolment photos, so they can be enrolled again
[**faceControllerEnrol**](FaceApi.md#facecontrollerenrol) | **POST** /api/v1/face/enrolments | Add one enrolment photo (up to 5); the photo is embedded and dropped
[**faceControllerListEnrolments**](FaceApi.md#facecontrollerlistenrolments) | **GET** /api/v1/face/enrolments/{staffId} | A person&#39;s enrolled face photos (dates only; never the photo or embedding)


# **faceControllerCaptureOptions**
> FaceCaptureOptionsDto faceControllerCaptureOptions(staffId)

Which face capture flow the app should run (local or Aadhaar FaceRD)

### Example
```dart
import 'package:fieldops_api/api.dart';

final api = FieldopsApi().getFaceApi();
final String staffId = staffId_example; // String | Who is being verified; defaults to the caller. Others only for inspectors and above (proxy marking).

try {
    final response = api.faceControllerCaptureOptions(staffId);
    print(response);
} catch on DioException (e) {
    print('Exception when calling FaceApi->faceControllerCaptureOptions: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **staffId** | **String**| Who is being verified; defaults to the caller. Others only for inspectors and above (proxy marking). | [optional] 

### Return type

[**FaceCaptureOptionsDto**](FaceCaptureOptionsDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faceControllerClearEnrolments**
> faceControllerClearEnrolments(staffId)

Remove all of a person's enrolment photos, so they can be enrolled again

### Example
```dart
import 'package:fieldops_api/api.dart';

final api = FieldopsApi().getFaceApi();
final String staffId = staffId_example; // String | 

try {
    api.faceControllerClearEnrolments(staffId);
} catch on DioException (e) {
    print('Exception when calling FaceApi->faceControllerClearEnrolments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **staffId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faceControllerEnrol**
> FaceEnrolmentDto faceControllerEnrol(createFaceEnrolmentDto)

Add one enrolment photo (up to 5); the photo is embedded and dropped

### Example
```dart
import 'package:fieldops_api/api.dart';

final api = FieldopsApi().getFaceApi();
final CreateFaceEnrolmentDto createFaceEnrolmentDto = ; // CreateFaceEnrolmentDto | 

try {
    final response = api.faceControllerEnrol(createFaceEnrolmentDto);
    print(response);
} catch on DioException (e) {
    print('Exception when calling FaceApi->faceControllerEnrol: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **createFaceEnrolmentDto** | [**CreateFaceEnrolmentDto**](CreateFaceEnrolmentDto.md)|  | 

### Return type

[**FaceEnrolmentDto**](FaceEnrolmentDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faceControllerListEnrolments**
> FaceEnrolmentListDto faceControllerListEnrolments(staffId)

A person's enrolled face photos (dates only; never the photo or embedding)

### Example
```dart
import 'package:fieldops_api/api.dart';

final api = FieldopsApi().getFaceApi();
final String staffId = staffId_example; // String | 

try {
    final response = api.faceControllerListEnrolments(staffId);
    print(response);
} catch on DioException (e) {
    print('Exception when calling FaceApi->faceControllerListEnrolments: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **staffId** | **String**|  | 

### Return type

[**FaceEnrolmentListDto**](FaceEnrolmentListDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

